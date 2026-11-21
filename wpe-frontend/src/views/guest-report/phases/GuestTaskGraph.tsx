import { useId, useMemo, useState } from 'react'
import type { GuestReportPhase, GuestTask } from '../../../domain/guestReport'
import { Avatar, STATUS_BAR, STATUS_CHIP, StatusDot, type AvatarPerson } from '../ui'
import { TASK_GRAPH_DIMS, countTaskGraphGhosts, layoutTaskGraph } from './layoutTaskGraph'
import { isTaskLateDone, isTaskOverdue, taskLateBy } from './taskHelpers'
import { GUEST_PAN_HINT, GUEST_ZOOM_MIN, useGuestPanZoom } from './useGuestPanZoom'
import { ZoomBar } from './ZoomBar'

const MAX_HEIGHT = 440
const LEGEND_STATUSES = ['DONE', 'REVIEW', 'IN_PROGRESS', 'TODO', 'LOCKED'] as const

export interface GuestTaskGraphProps {
  phase: GuestReportPhase
  allPhases: GuestReportPhase[]
  byId: Record<string, GuestTask>
  people: Record<string, AvatarPerson>
  serverNow: Date
  selectedTaskId: string | null
  onPickTask: (taskId: string) => void
}

export function GuestTaskGraph({
  phase,
  allPhases,
  byId,
  people,
  serverNow,
  selectedTaskId,
  onPickTask,
}: GuestTaskGraphProps) {
  const ghostCount = useMemo(() => countTaskGraphGhosts(phase, byId), [phase, byId])
  const [showGhosts, setShowGhosts] = useState(() => ghostCount <= 10)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const markerPrefix = useId().replace(/:/g, '')

  const layout = useMemo(
    () => layoutTaskGraph(phase, byId, showGhosts, TASK_GRAPH_DIMS),
    [phase, byId, showGhosts],
  )

  const pz = useGuestPanZoom(({ w }) => {
    if (layout.w === 0 || layout.h === 0) return { start: 1, all: 1 }
    return {
      start: Math.max(0.5, Math.min(1, (w - 8) / layout.w)),
      all: Math.max(GUEST_ZOOM_MIN, Math.min(1, (w - 8) / layout.w, (MAX_HEIGHT - 8) / layout.h)),
    }
  })

  const z = pz.z

  const phaseIndexById = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of allPhases) {
      map[p.id] = p.index
    }
    return map
  }, [allPhases])

  const phaseOf = (task: GuestTask): string => {
    if (!task.phaseId) return 'No phase'
    const idx = phaseIndexById[task.phaseId]
    return idx !== undefined && idx >= 0 ? `Phase ${idx + 1}` : 'No phase'
  }

  if (phase.tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-400">
        No tasks in this phase.
      </div>
    )
  }

  const refOf: Record<string, GuestTask> = {}
  for (const n of layout.nodes) {
    refOf[n.id] = n.ref
  }

  const focus = hoverId ?? selectedTaskId
  const near = hoverId
    ? new Set<string>([
        hoverId,
        ...layout.edges
          .filter((e) => e.from === hoverId || e.to === hoverId)
          .flatMap((e) => [e.from, e.to]),
      ])
    : null

  const markerNormal = `${markerPrefix}-ta`
  const markerActive = `${markerPrefix}-taOn`
  const markerBlocked = `${markerPrefix}-taBl`

  return (
    <div
      data-testid="guest-task-graph"
      className="overflow-hidden rounded-xl border border-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
        <span>
          Arrows go from a task to the tasks waiting for it. Click a card for its detail.{' '}
          <span className="hidden text-slate-400 sm:inline">{GUEST_PAN_HINT}.</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {ghostCount > 0 && (
            <label className="mr-1 flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5 font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showGhosts}
                onChange={(e) => {
                  setShowGhosts(e.target.checked)
                  pz.reset()
                }}
                className="accent-indigo-600"
              />
              <span>Other phases ({ghostCount})</span>
            </label>
          )}
          <ZoomBar pz={pz} />
        </span>
      </div>

      <div
        ref={pz.ref}
        {...pz.bind}
        className={`overflow-auto ${pz.dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        style={{
          maxHeight: MAX_HEIGHT,
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: '#f8fafc',
        }}
      >
        <div style={{ width: layout.w * z, height: layout.h * z, minWidth: '100%' }}>
          <div
            className="relative"
            style={{
              width: layout.w,
              height: layout.h,
              transform: `scale(${z})`,
              transformOrigin: '0 0',
            }}
          >
            <svg width={layout.w} height={layout.h} className="pointer-events-none absolute inset-0">
              <defs>
                <marker
                  id={markerNormal}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8z" fill="#94a3b8" />
                </marker>
                <marker
                  id={markerActive}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8z" fill="#4f46e5" />
                </marker>
                <marker
                  id={markerBlocked}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8z" fill="#e11d48" />
                </marker>
              </defs>

              {layout.edges.map((edge) => {
                const a = layout.pos[edge.from]
                const b = layout.pos[edge.to]
                if (!a || !b) return null
                const x1 = a.x + TASK_GRAPH_DIMS.NW
                const y1 = a.y + TASK_GRAPH_DIMS.NH / 2
                const x2 = b.x - 2
                const y2 = b.y + TASK_GRAPH_DIMS.NH / 2
                const on = Boolean(focus && (edge.from === focus || edge.to === focus))
                const fromTask = refOf[edge.from]
                const toTask = refOf[edge.to]
                const blocking = toTask?.status === 'LOCKED' && fromTask?.status !== 'DONE'
                return (
                  <path
                    key={`${edge.from}>${edge.to}`}
                    d={`M${x1},${y1} C${x1 + TASK_GRAPH_DIMS.CG / 2},${y1} ${x2 - TASK_GRAPH_DIMS.CG / 2},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={on ? '#4f46e5' : blocking ? '#e11d48' : '#94a3b8'}
                    strokeWidth={on || blocking ? 2 : 1.4}
                    strokeDasharray={blocking && !on ? '5 4' : undefined}
                    opacity={near && !on ? 0.25 : 1}
                    markerEnd={`url(#${on ? markerActive : blocking ? markerBlocked : markerNormal})`}
                    data-blocking={blocking ? 'true' : undefined}
                  />
                )
              })}
            </svg>

            {layout.nodes.map((node) => {
              const task = node.ref
              const pos = layout.pos[node.id]
              const ghost = node.dir !== null
              const isSelected = !ghost && task.id === selectedTaskId
              const dim = Boolean(near && !near.has(node.id))
              const overdue = isTaskOverdue(task, serverNow)
              const lateDone = isTaskLateDone(task)

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onPickTask(task.id)}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                  title={`${task.code} · ${task.title}`}
                  data-graph-node-id={node.id}
                  data-ghost={ghost ? node.dir : undefined}
                  className={`absolute flex flex-col justify-start gap-0.5 overflow-hidden rounded-lg border-l-4 px-2.5 py-1.5 text-left shadow-sm transition ${
                    STATUS_BAR[task.status] ?? STATUS_BAR.TODO
                  } ${
                    ghost
                      ? 'border border-dashed border-slate-300 bg-white/75'
                      : isSelected
                        ? 'border border-indigo-400 bg-white ring-2 ring-indigo-200'
                        : 'border border-slate-200 bg-white hover:border-indigo-300'
                  } ${dim ? 'opacity-30' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: TASK_GRAPH_DIMS.NW,
                    height: TASK_GRAPH_DIMS.NH,
                  }}
                >
                  {ghost && (
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {node.dir === 'up' ? 'Needed from' : 'Unlocks in'} {phaseOf(task)}
                    </span>
                  )}

                  <span className="flex w-full items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500">{task.code}</span>
                    {overdue && (
                      <span className="rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-700">
                        overdue
                      </span>
                    )}
                    {lateDone && (
                      <span className="rounded bg-orange-50 px-1 text-[10px] font-semibold text-orange-700">
                        +{taskLateBy(task)}d
                      </span>
                    )}
                    {!ghost && (
                      <span className="ml-auto">
                        <Avatar
                          person={task.assigneeId ? people[task.assigneeId] ?? null : null}
                          size="h-5 w-5 text-[10px]"
                        />
                      </span>
                    )}
                  </span>

                  <span
                    className={`${
                      ghost ? 'line-clamp-1' : 'line-clamp-2'
                    } text-[11.5px] font-medium leading-tight text-slate-800`}
                  >
                    {task.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-white px-3 py-1.5 text-[10.5px] text-slate-500">
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <StatusDot status={s} />
            <span>{STATUS_CHIP[s][0]}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-4 rounded border border-dashed border-slate-400" />
          <span>task in another phase</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-rose-500" />
          <span>blocking: waits on an unfinished task</span>
        </span>
      </div>
    </div>
  )
}
