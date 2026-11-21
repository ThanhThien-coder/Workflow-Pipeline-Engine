import { useEffect, useMemo, useState } from 'react'
import type { GuestReportModel, GuestReportPhase, GuestTask } from '../../domain/guestReport'
import type { GuestReportDto } from '../../types/guest.types'
import { StatusChip } from './ui'
import { TASK_GRAPH_ENABLED } from './phases/flags'
import { GuestPhaseMap } from './phases/GuestPhaseMap'
import { GuestTaskGraph } from './phases/GuestTaskGraph'
import { PhaseHeader } from './phases/PhaseHeader'
import { PhaseList } from './phases/PhaseList'
import { TaskDetails } from './phases/TaskDetails'
import { TaskList } from './phases/TaskList'
import {
  buildArtifactsByTask,
  buildAvatarPeople,
  buildEstimatedHoursById,
  countPhaseArtifacts,
  isTaskLateDone,
  isTaskOverdue,
  taskLateBy,
  taskOverdueDays,
} from './phases/taskHelpers'

export interface GuestPhaseExplorerProps {
  model: GuestReportModel
  graph: GuestReportDto['graph']
  selectedPhaseId: string | null // 'none' = nhóm task không có phase
  onSelectPhase: (phaseId: string) => void
  focusTaskId: string | null // task cần mở và cuộn tới
  focusSeq?: number // tăng mỗi lần bấm nhảy tới task (kể cả bấm lại cùng task)
  onCommentTask: (taskId: string) => void
  onCommentPhase: (phaseId: string) => void
}

type ViewMode = 'graph' | 'list'

function defaultViewMode(): ViewMode {
  if (!TASK_GRAPH_ENABLED) return 'list'
  if (typeof window !== 'undefined' && window.innerWidth < 640) return 'list'
  return 'graph'
}

function pickDefaultTask(phase: GuestReportPhase, serverNow: Date): GuestTask | null {
  return (
    phase.tasks.find((t) => isTaskOverdue(t, serverNow)) ??
    phase.tasks.find((t) => isTaskLateDone(t)) ??
    null
  )
}

export function GuestPhaseExplorer({
  model,
  graph,
  selectedPhaseId,
  onSelectPhase,
  focusTaskId,
  focusSeq,
  onCommentTask,
  onCommentPhase,
}: GuestPhaseExplorerProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(focusTaskId)
  const [focusTick, setFocusTick] = useState(0)
  const [graphFlashId, setGraphFlashId] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>(defaultViewMode)

  useEffect(() => {
    setActiveTaskId(focusTaskId)
    if (focusTaskId) {
      setFocusTick((t) => t + 1)
    }
  }, [focusTaskId, focusSeq])

  useEffect(() => {
    if (!activeTaskId || focusTick === 0 || mode !== 'graph') return
    setGraphFlashId(activeTaskId)
    const scrollTimer = window.setTimeout(() => {
      const el =
        document.getElementById(`guest-graph-detail-${activeTaskId}`) ??
        document.getElementById('guest-phase-inspector')
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }, 0)
    const timer = window.setTimeout(() => {
      setGraphFlashId((curr) => (curr === activeTaskId ? null : curr))
    }, 1800)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(timer)
    }
  }, [activeTaskId, focusTick, mode])

  const people = useMemo(() => buildAvatarPeople(model.members), [model.members])
  const artifactsByTask = useMemo(() => buildArtifactsByTask(model.artifacts), [model.artifacts])
  const estimatedHoursById = useMemo(() => buildEstimatedHoursById(graph), [graph])

  const activePhase = useMemo(() => {
    if (selectedPhaseId) {
      const found = model.phases.find((p) => p.id === selectedPhaseId)
      if (found) return found
    }
    if (activeTaskId) {
      const target = model.byId[activeTaskId]
      if (target) {
        const targetPhaseId = target.phaseId ?? 'none'
        const found = model.phases.find((p) => p.id === targetPhaseId)
        if (found) return found
      }
    }
    return model.metrics.currentPhase ?? model.phases[0] ?? null
  }, [selectedPhaseId, activeTaskId, model.phases, model.byId, model.metrics.currentPhase])

  const handleJumpTask = (taskId: string) => {
    const target = model.byId[taskId]
    if (!target) return
    const targetPhaseId = target.phaseId ?? 'none'
    if (!activePhase || targetPhaseId !== activePhase.id) {
      onSelectPhase(targetPhaseId)
    }
    setActiveTaskId(taskId)
    setFocusTick((t) => t + 1)
  }

  if (model.phases.length === 0 || !activePhase) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No phases or tasks yet.
      </div>
    )
  }

  const hasRealPhases = model.phases.some((p) => p.index >= 0)
  const unphased = model.phases.find((p) => p.index === -1) ?? null
  const phaseArtifactCount = countPhaseArtifacts(activePhase, artifactsByTask)
  const effectiveMode: ViewMode = TASK_GRAPH_ENABLED ? mode : 'list'

  const graphSelectedTask: GuestTask | null = (() => {
    if (activeTaskId) {
      const inPhase = activePhase.tasks.find((t) => t.id === activeTaskId)
      if (inPhase) return inPhase
    }
    return pickDefaultTask(activePhase, model.serverNow)
  })()

  const modeSwitcher = TASK_GRAPH_ENABLED ? (
    <div
      role="group"
      aria-label="Task view mode"
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]"
    >
      {(
        [
          ['graph', 'Task graph'],
          ['list', 'Task list'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setMode(key)}
          aria-pressed={effectiveMode === key}
          className={`rounded-md px-2.5 py-1 font-semibold transition ${
            effectiveMode === key
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null

  const renderTaskList = (printOnly: boolean) => (
    <TaskList
      phase={activePhase}
      byId={model.byId}
      people={people}
      artifactsByTask={artifactsByTask}
      estimatedHoursById={estimatedHoursById}
      serverNow={model.serverNow}
      focusTaskId={printOnly ? null : activeTaskId}
      focusTick={printOnly ? 0 : focusTick}
      printOnly={printOnly}
      onJumpTask={handleJumpTask}
      onCommentTask={onCommentTask}
    />
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white print:break-inside-auto print:shadow-none">
      {hasRealPhases ? (
        <>
          <div className="hidden sm:block print:hidden">
            <GuestPhaseMap
              phases={model.phases}
              phaseEdges={graph?.phaseEdges}
              selectedPhaseId={activePhase.id}
              artifactsByTask={artifactsByTask}
              onSelectPhase={onSelectPhase}
            />
            {unphased && (
              <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => onSelectPhase(unphased.id)}
                  aria-pressed={activePhase.id === unphased.id}
                  className={`font-semibold hover:underline ${
                    activePhase.id === unphased.id ? 'text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  Tasks without a phase ({unphased.tasks.length})
                </button>{' '}
                <span className="text-slate-400">· not part of the phase map</span>
              </div>
            )}
          </div>

          <div data-testid="guest-phase-list-wrapper" className="block sm:hidden print:block">
            <PhaseList
              phases={model.phases}
              selectedPhaseId={activePhase.id}
              artifactsByTask={artifactsByTask}
              onSelectPhase={onSelectPhase}
            />
          </div>
        </>
      ) : (
        <div data-testid="guest-phase-list-wrapper">
          <PhaseList
            phases={model.phases}
            selectedPhaseId={activePhase.id}
            artifactsByTask={artifactsByTask}
            onSelectPhase={onSelectPhase}
          />
        </div>
      )}

      <div id="guest-phase-inspector" className="scroll-mt-28 p-4 sm:p-5">
        <PhaseHeader
          phase={activePhase}
          allPhases={model.phases}
          artifactCount={phaseArtifactCount}
          onCommentPhase={onCommentPhase}
          rightSlot={modeSwitcher}
        />

        {effectiveMode === 'graph' ? (
          <>
            <div data-testid="guest-task-graph-panel" className="print:hidden">
              <GuestTaskGraph
                key={activePhase.id}
                phase={activePhase}
                allPhases={model.phases}
                byId={model.byId}
                people={people}
                serverNow={model.serverNow}
                selectedTaskId={graphSelectedTask ? graphSelectedTask.id : null}
                onPickTask={handleJumpTask}
              />

              {graphSelectedTask ? (
                <div
                  id={`guest-graph-detail-${graphSelectedTask.id}`}
                  className={`mt-3 rounded-xl border border-slate-200 p-3 transition-colors duration-700 ${
                    graphFlashId === graphSelectedTask.id ? 'bg-indigo-100/70' : 'bg-white'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      {graphSelectedTask.code}
                    </span>
                    <b className="text-sm text-slate-900">{graphSelectedTask.title}</b>
                    <StatusChip status={graphSelectedTask.status} />
                    {isTaskOverdue(graphSelectedTask, model.serverNow) && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-700">
                        Overdue {taskOverdueDays(graphSelectedTask, model.serverNow)}d
                      </span>
                    )}
                    {isTaskLateDone(graphSelectedTask) && (
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-orange-700">
                        +{taskLateBy(graphSelectedTask)}d late
                      </span>
                    )}
                    {graphSelectedTask.reopened && (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700">
                        Reopened
                      </span>
                    )}
                  </div>
                  <TaskDetails
                    flush
                    task={graphSelectedTask}
                    byId={model.byId}
                    people={people}
                    artifacts={artifactsByTask[graphSelectedTask.id] ?? []}
                    estimatedHours={estimatedHoursById[graphSelectedTask.id] ?? null}
                    onJumpTask={handleJumpTask}
                    onCommentTask={onCommentTask}
                  />
                </div>
              ) : (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Click a task in the graph to see its detail here.
                </p>
              )}
            </div>

            <div data-testid="guest-task-list-print" className="hidden print:block">
              {renderTaskList(true)}
            </div>
          </>
        ) : (
          <div data-testid="guest-task-list-panel">{renderTaskList(false)}</div>
        )}
      </div>
    </div>
  )
}
