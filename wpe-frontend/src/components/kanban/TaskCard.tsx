import type { KanbanTask, UserSummary } from '../../types/kanban.types'
import { getSavedAvatar } from '../../utils/avatarUtils'

export interface TaskCardProps {
  task: KanbanTask
  /** Người đang xem (My Tasks): chỉ dùng để hiện người làm khi task đúng là của người đó. */
  actor?: UserSummary
  /** Thành viên được giao task (tra theo assignedUserId). */
  member?: UserSummary
  onOpenDetails: (task: KanbanTask) => void
  onDragStart?: (id: string) => void
  dragging?: boolean
}

export function TaskCard({
  task,
  actor,
  member,
  onOpenDetails,
  onDragStart,
  dragging = false,
}: TaskCardProps) {
  const frozen = task.status === 'DONE'
  const locked = task.status === 'LOCKED'
  const canDrag = !frozen && !locked && Boolean(onDragStart)
  const phaseText = task.phaseLabel || ''
  const assignee = !task.assignedUserId
    ? undefined
    : member ?? (actor?.id === task.assignedUserId ? actor : undefined)
  // Chưa giao: hiện "Chưa giao", không lấy người đang xem hay tên mặc định
  const assigneeName = !task.assignedUserId ? 'Chưa giao' : assignee?.name ?? 'Thành viên khác'
  const assigneeInitials = assignee?.initials ?? (task.assignedUserId ? '?' : '–')
  const avatarClass = assignee?.avatarClass ?? 'bg-slate-300'
  const avatarUrl = assignee ? assignee.avatarUrl || getSavedAvatar(assignee.name) : null

  return (
    <div
      data-testid={`task-card-${task.id}`}
      draggable={canDrag}
      onDragStart={() => onDragStart?.(task.id)}
      onClick={() => onOpenDetails(task)}
      className={`group rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2.5 min-h-[96px] w-full select-none ${
        frozen ? 'border-emerald-200/80 bg-emerald-50/20' : ''
      } ${locked ? 'bg-slate-50/80' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      {/* 1. Header: Code & Phase */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold text-slate-400">
          {task.code}
        </span>
        <span className="max-w-[130px] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {phaseText}
        </span>
      </div>

      {/* 2. Title */}
      <h4 className="line-clamp-2 text-xs font-bold leading-snug text-slate-800 transition-colors group-hover:text-indigo-600">
        {task.title}
      </h4>
      {locked && (
        <span className="w-fit rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          🔒 Chờ task trước
        </span>
      )}
      {task.forceUnlocked && (
        <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          Mở sớm
        </span>
      )}

      {/* 3. Footer: Nằm trọn vẹn bên trong card */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1.5" title={assigneeName}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={assigneeName}
              className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white"
            />
          ) : (
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white ${avatarClass}`}
            >
              {assigneeInitials}
            </div>
          )}
          <span className="max-w-[90px] truncate text-[11px] font-medium text-slate-600">
            {assigneeName}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetails(task)
          }}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
        >
          Details <span>↗</span>
        </button>
      </div>
    </div>
  )
}
