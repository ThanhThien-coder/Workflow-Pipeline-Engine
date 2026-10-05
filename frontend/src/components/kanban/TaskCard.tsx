import type { KanbanTask, UserSummary } from '../../types/kanban.types'

const DEFAULT_MEMBERS: Record<string, { name: string; initials: string; avatarClass: string }> = {
  '1': { name: 'Alex Kim', initials: 'AK', avatarClass: 'bg-emerald-500' },
  '2': { name: 'Sarah Chen', initials: 'SC', avatarClass: 'bg-indigo-500' },
  '3': { name: 'Marcus Liu', initials: 'ML', avatarClass: 'bg-rose-500' },
  '4': { name: 'Jamie Doe', initials: 'JD', avatarClass: 'bg-amber-500' },
}

export interface TaskCardProps {
  task: KanbanTask
  actor?: UserSummary
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
  const phaseText = task.phaseLabel || (task as unknown as { phaseName?: string }).phaseName || ''
  const fallback = DEFAULT_MEMBERS[task.assignedUserId]
  const targetUser = member || actor || fallback
  const assigneeName =
    targetUser?.name ||
    (task as unknown as { assignee?: { name: string; initials: string } }).assignee?.name ||
    fallback?.name ||
    ''
  const assigneeInitials =
    targetUser?.initials ||
    (task as unknown as { assignee?: { name: string; initials: string } }).assignee?.initials ||
    fallback?.initials ||
    'AK'
  const avatarClass = targetUser?.avatarClass || fallback?.avatarClass || 'bg-emerald-500'

  return (
    <div
      draggable={!frozen && Boolean(onDragStart)}
      onDragStart={() => onDragStart?.(task.id)}
      onClick={() => onOpenDetails(task)}
      className={`group rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2.5 min-h-[96px] w-full select-none ${
        frozen ? 'border-emerald-200/80 bg-emerald-50/20' : ''
      } ${!frozen ? 'cursor-grab active:cursor-grabbing' : ''} ${
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

      {/* 3. Footer: Nằm trọn vẹn bên trong card */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-1.5" title={assigneeName}>
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white ${avatarClass}`}
          >
            {assigneeInitials}
          </div>
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
