import { useMemo, useState } from 'react'
import type { KanbanTask, TaskStatus, UserSummary } from '../../types/kanban.types'
import { TaskCard } from './TaskCard'

// Cột "Đang khóa" đứng đầu: task chờ task trước xong. Không kéo ra khỏi cột này, cũng không thả vào.
const COLUMNS: TaskStatus[] = ['LOCKED', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

const COLUMN_CONFIG: Record<
  TaskStatus,
  {
    title: string
    headClass: string
    badgeClass: string
    ringClass: string
    dotClass: string
  }
> = {
  LOCKED: {
    title: '🔒 Locked',
    headClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-200 text-slate-600',
    ringClass: 'ring-slate-300',
    dotClass: 'bg-slate-400',
  },
  TODO: {
    title: 'To Do',
    headClass: 'bg-sky-100 text-sky-800',
    badgeClass: 'bg-sky-200 text-sky-800',
    ringClass: 'ring-sky-300',
    dotClass: 'bg-sky-500',
  },
  IN_PROGRESS: {
    title: 'In Progress',
    headClass: 'bg-blue-600 text-white',
    badgeClass: 'bg-white/25 text-white',
    ringClass: 'ring-blue-300',
    dotClass: 'bg-white',
  },
  REVIEW: {
    title: 'In Review',
    headClass: 'bg-violet-100 text-violet-800',
    badgeClass: 'bg-violet-200 text-violet-800',
    ringClass: 'ring-violet-300',
    dotClass: 'bg-violet-500',
  },
  DONE: {
    title: 'Done',
    headClass: 'bg-emerald-100 text-emerald-800',
    badgeClass: 'bg-emerald-200 text-emerald-800',
    ringClass: 'ring-emerald-300',
    dotClass: 'bg-emerald-500',
  },
}

export interface PhaseKanbanBoardProps {
  phaseId: string
  tasks: KanbanTask[]
  members?: UserSummary[]
  actor?: UserSummary
  pendingIds?: string[]
  onOpenTaskDetails: (task: KanbanTask) => void
  onMoveTask?: (taskId: string, to: TaskStatus) => void
}

export function PhaseKanbanBoard({
  phaseId: _phaseId,
  tasks,
  members = [],
  actor: _actor,
  pendingIds = [],
  onOpenTaskDetails,
  onMoveTask,
}: PhaseKanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  )

  const groupedTasks = useMemo(() => {
    const map: Record<TaskStatus, KanbanTask[]> = {
      LOCKED: [],
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    }
    for (const task of tasks) {
      map[task.status]?.push(task)
    }
    return map
  }, [tasks])

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* 1. Header Metrics / Summary Bar */}
      <div className="flex items-center justify-between pb-3 text-xs text-slate-500 border-b border-slate-100 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">Phase Kanban Board</span>
          <span className="text-slate-300">·</span>
          <span className="font-medium text-slate-600">{tasks.length} total tasks</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {groupedTasks.LOCKED.length} Locked
          </span>
          <span className="flex items-center gap-1.5 font-medium text-sky-700">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            {groupedTasks.TODO.length} To Do
          </span>
          <span className="flex items-center gap-1.5 font-medium text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {groupedTasks.IN_PROGRESS.length} In Progress
          </span>
          <span className="flex items-center gap-1.5 font-medium text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            {groupedTasks.REVIEW.length} In Review
          </span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {groupedTasks.DONE.length} Done
          </span>
        </div>
      </div>

      {/* 2. 5 cột: Đang khóa · To Do · In Progress · In Review · Done (hẹp thì cuộn ngang) */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-1">
        <div className="grid grid-cols-5 gap-3.5 h-full min-w-[880px]">
          {COLUMNS.map((column) => {
            const config = COLUMN_CONFIG[column]
            const columnTasks = groupedTasks[column]
            const isOver = overCol === column
            const isLockedColumn = column === 'LOCKED'

            return (
              <section
                key={column}
                data-testid={`kanban-column-${column}`}
                onDragOver={(e) => {
                  // Cột Đang khóa không nhận thả: không gọi preventDefault thì trình duyệt không cho drop
                  if (isLockedColumn) return
                  e.preventDefault()
                  setOverCol(column)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverCol(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain') || dragId
                  if (id && onMoveTask && !isLockedColumn) {
                    onMoveTask(id, column)
                  }
                  setDragId(null)
                  setOverCol(null)
                }}
                className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-slate-100/70 transition-all ${
                  isOver
                    ? `ring-2 ${config.ringClass} border-transparent bg-white shadow-md`
                    : 'border-slate-200/90'
                }`}
              >
                {/* Column Header */}
                <header
                  className={`flex shrink-0 items-center justify-between rounded-t-2xl px-3.5 py-2 ${config.headClass}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
                    <h3 className="text-xs font-bold tracking-tight">{config.title}</h3>
                  </div>
                  <span
                    className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${config.badgeClass}`}
                  >
                    {columnTasks.length}
                  </span>
                </header>

                {/* Cards Container with Hidden Browser Scrollbars */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {columnTasks.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-white/40 text-center text-xs text-slate-400">
                      <span>No tasks yet</span>
                      {!isLockedColumn && (
                        <span className="text-[10px] text-slate-400/80 mt-0.5">
                          Drop tasks here
                        </span>
                      )}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const assignee = memberMap.get(task.assignedUserId)
                      const isPending = pendingIds.includes(task.id)

                      return (
                        <div
                          key={task.id}
                          className={`transition-opacity ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <TaskCard
                            task={task}
                            member={assignee}
                            onOpenDetails={onOpenTaskDetails}
                            onDragStart={isLockedColumn ? undefined : (id) => setDragId(id)}
                            dragging={dragId === task.id}
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default PhaseKanbanBoard
