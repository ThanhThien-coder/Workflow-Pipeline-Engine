import { useEffect, useMemo, useState } from 'react'
import type { GuestArtifact, GuestReportPhase, GuestTask } from '../../../domain/guestReport'
import { Avatar, StatusChip, fmtDay, plural, type AvatarPerson } from '../ui'
import { PHASE_ICON_PATHS, PhaseIcon } from './icons'
import { TaskDetails } from './TaskDetails'
import { isTaskLateDone, isTaskOverdue, taskLateBy, taskOverdueDays } from './taskHelpers'

const ROW_LIMIT = 10

export type TaskFilterKey = 'all' | 'late' | 'waiting' | 'deliv'

export interface TaskListProps {
  phase: GuestReportPhase
  byId: Record<string, GuestTask>
  people: Record<string, AvatarPerson>
  artifactsByTask: Record<string, GuestArtifact[]>
  estimatedHoursById: Record<string, number | null>
  serverNow: Date
  focusTaskId: string | null
  focusTick: number
  printOnly?: boolean
  onJumpTask: (taskId: string) => void
  onCommentTask: (taskId: string) => void
}

function TaskRow({
  task,
  byId,
  people,
  artifacts,
  estimatedHours,
  serverNow,
  open,
  flash,
  printOnly,
  onToggle,
  onJumpTask,
  onCommentTask,
}: {
  task: GuestTask
  byId: Record<string, GuestTask>
  people: Record<string, AvatarPerson>
  artifacts: GuestArtifact[]
  estimatedHours: number | null
  serverNow: Date
  open: boolean
  flash: boolean
  printOnly?: boolean
  onToggle: () => void
  onJumpTask: (taskId: string) => void
  onCommentTask: (taskId: string) => void
}) {
  const person = task.assigneeId ? people[task.assigneeId] ?? null : null
  const overdue = isTaskOverdue(task, serverNow)

  let badge = null
  if (task.status === 'DONE' && task.done) {
    if (task.due) {
      const late = taskLateBy(task)
      badge =
        late <= 0 ? (
          <span className="whitespace-nowrap text-[11px] font-semibold text-emerald-600">
            on time · {fmtDay(task.done)}
          </span>
        ) : (
          <span
            className="whitespace-nowrap rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700"
            title={`Due ${fmtDay(task.due)}, done ${fmtDay(task.done)}`}
          >
            +{late}d late · {fmtDay(task.done)}
          </span>
        )
    } else {
      badge = (
        <span className="whitespace-nowrap text-[11px] font-semibold text-emerald-600">
          done · {fmtDay(task.done)}
        </span>
      )
    }
  } else if (overdue) {
    badge = (
      <span className="whitespace-nowrap rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
        Overdue {taskOverdueDays(task, serverNow)}d
      </span>
    )
  }

  const blockedCodes = task.blocks.map((id) => byId[id]?.code ?? id)
  const firstWaitingCode =
    task.waitingOn.length > 0 ? byId[task.waitingOn[0]]?.code ?? task.waitingOn[0] : null

  return (
    <div
      id={printOnly ? undefined : `guest-task-${task.id}`}
      data-task-id={task.id}
      data-task-code={task.code}
      className={`border-t border-slate-100 transition-colors duration-700 ${
        flash ? 'bg-indigo-100/70' : ''
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-1 py-2.5 hover:bg-slate-50 sm:grid sm:grid-cols-[64px_minmax(0,1fr)_86px_74px_132px_16px]"
      >
        <span className="w-14 shrink-0 font-mono text-[11px] text-slate-500 sm:w-auto">
          {task.code}
        </span>

        <div className="flex min-w-0 flex-1 basis-[65%] items-start gap-2 sm:basis-auto">
          <Avatar person={person} />
          <div className="min-w-0">
            <span className="line-clamp-2 text-sm leading-snug text-slate-800" title={task.title}>
              {task.title}
            </span>
            {(task.blocks.length > 0 ||
              (task.status === 'LOCKED' && firstWaitingCode) ||
              task.reopened) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {task.blocks.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-px text-[10px] font-semibold ${
                      overdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                    }`}
                    title={`Waiting on this task, directly or further down the chain: ${blockedCodes.join(', ')}`}
                  >
                    Blocks {plural(task.blocks.length, 'task')}
                  </span>
                )}
                {task.status === 'LOCKED' && firstWaitingCode && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
                    <PhaseIcon paths={PHASE_ICON_PATHS.lock} className="h-3 w-3 shrink-0" />
                    <span>
                      Waiting on <span className="font-mono">{firstWaitingCode}</span>
                      {task.waitingOn.length > 1 && ` +${task.waitingOn.length - 1}`}
                    </span>
                  </span>
                )}
                {task.reopened && (
                  <span
                    className="rounded bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700"
                    title="Re-opened after approval and redone"
                  >
                    Reopened
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ml-[64px] sm:ml-0">
          <StatusChip status={task.status} />
        </div>

        <div className="whitespace-nowrap text-[11px] text-slate-500">Due {fmtDay(task.due)}</div>

        <div className="ml-auto flex items-center justify-end gap-2 sm:ml-0">
          {badge}
          {artifacts.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600"
              title={artifacts.map((a) => a.name).join('\n')}
            >
              <PhaseIcon paths={PHASE_ICON_PATHS.clip} className="h-3.5 w-3.5" />
              {artifacts.length}
            </span>
          )}
        </div>

        <span className="hidden text-slate-400 sm:block print:hidden">
          <PhaseIcon
            paths={PHASE_ICON_PATHS.chev}
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </span>
      </div>

      {open && (
        <TaskDetails
          task={task}
          byId={byId}
          people={people}
          artifacts={artifacts}
          estimatedHours={estimatedHours}
          onJumpTask={onJumpTask}
          onCommentTask={onCommentTask}
        />
      )}
    </div>
  )
}

export function TaskList({
  phase,
  byId,
  people,
  artifactsByTask,
  estimatedHoursById,
  serverNow,
  focusTaskId,
  focusTick,
  printOnly = false,
  onJumpTask,
  onCommentTask,
}: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilterKey>('all')
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    !printOnly && focusTaskId ? new Set([focusTaskId]) : new Set(),
  )
  const [showMore, setShowMore] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    setFilter('all')
    setShowMore(false)
  }, [phase.id])

  const inPhaseFocus = useMemo(
    () => (focusTaskId ? phase.tasks.find((t) => t.id === focusTaskId) ?? null : null),
    [focusTaskId, phase.tasks],
  )

  useEffect(() => {
    if (printOnly || !inPhaseFocus) return
    setFilter('all')
    const idx = phase.tasks.findIndex((t) => t.id === inPhaseFocus.id)
    if (idx >= ROW_LIMIT) setShowMore(true)
    setOpenIds((prev) => {
      if (prev.has(inPhaseFocus.id)) return prev
      const next = new Set(prev)
      next.add(inPhaseFocus.id)
      return next
    })
    setFlashId(inPhaseFocus.id)

    const scrollTimer = window.setTimeout(() => {
      const el = document.getElementById(`guest-task-${inPhaseFocus.id}`)
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 0)

    const timer = window.setTimeout(() => {
      setFlashId((curr) => (curr === inPhaseFocus.id ? null : curr))
    }, 1800)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(timer)
    }
  }, [inPhaseFocus, focusTick, phase.tasks, printOnly])

  const filteredTasks = useMemo(() => {
    return phase.tasks.filter((task) => {
      if (filter === 'all') return true
      if (filter === 'late') return isTaskLateDone(task) || isTaskOverdue(task, serverNow)
      if (filter === 'waiting') return task.status === 'LOCKED'
      if (filter === 'deliv') return (artifactsByTask[task.id]?.length ?? 0) > 0
      return true
    })
  }, [phase.tasks, filter, serverNow, artifactsByTask])

  const visibleCount = showMore ? filteredTasks.length : Math.min(filteredTasks.length, ROW_LIMIT)

  const filterOptions: ReadonlyArray<[TaskFilterKey, string]> = [
    ['all', `All (${phase.tasks.length})`],
    ['late', 'Late or overdue'],
    ['waiting', 'Waiting'],
    ['deliv', 'Has deliverable'],
  ]

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5 print:hidden">
        {filterOptions.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key)
              setShowMore(false)
            }}
            aria-pressed={filter === key}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
              filter === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-400">
          No task in this phase matches the filter.
        </p>
      )}

      {filteredTasks.map((task, idx) => (
        <div key={task.id} className={idx < visibleCount ? '' : 'hidden print:block'}>
          <TaskRow
            task={task}
            byId={byId}
            people={people}
            artifacts={artifactsByTask[task.id] ?? []}
            estimatedHours={estimatedHoursById[task.id] ?? null}
            serverNow={serverNow}
            open={openIds.has(task.id)}
            flash={!printOnly && flashId === task.id}
            printOnly={printOnly}
            onToggle={() =>
              setOpenIds((prev) => {
                const next = new Set(prev)
                if (next.has(task.id)) next.delete(task.id)
                else next.add(task.id)
                return next
              })
            }
            onJumpTask={onJumpTask}
            onCommentTask={onCommentTask}
          />
        </div>
      ))}

      {filteredTasks.length > visibleCount && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="my-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 print:hidden"
        >
          Show {filteredTasks.length - visibleCount} more
        </button>
      )}
    </div>
  )
}
