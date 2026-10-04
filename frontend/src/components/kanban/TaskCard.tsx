import { AlertCircle, Calendar, Check, Clock, ExternalLink, Lock, Play, RotateCcw, Send, Undo2 } from 'lucide-react'
import type { KanbanTask, UserSummary } from '../../types/kanban.types'
import { artifactLabel } from '../../utils/artifactLabel'
import { fmtDayMonth } from '../../utils/date'

export function TaskCard({
  task,
  actor,
  pending,
  onMove,
  onDragStart,
  dragging,
}: {
  task: KanbanTask
  actor: UserSummary
  pending: boolean
  onMove: (to: KanbanTask['status']) => void
  onDragStart: (id: string) => void
  dragging: boolean
}) {
  const frozen = task.status === 'DONE'
  const latest = task.artifacts[task.artifacts.length - 1]
  const owner = actor.projectRole === 'OWNER'

  const actionBtn = (
    label: string,
    to: KanbanTask['status'],
    className: string,
    Icon: typeof Play,
  ) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => onMove(to)}
      className={`flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${className}`}
    >
      <Icon size={11} />
      {label}
    </button>
  )

  return (
    <article
      draggable={!frozen}
      onDragStart={() => onDragStart(task.id)}
      className={`flex h-full min-h-0 select-none flex-col justify-between overflow-hidden rounded-xl border p-2.5 shadow-sm transition-all ${
        frozen
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
      } ${!frozen ? 'cursor-grab active:cursor-grabbing' : ''} ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      {/* ── Row 1: Meta Header ── */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] font-bold text-slate-700">
          {task.code}
        </span>
        <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
          {task.phaseLabel}
        </span>
        {task.isOverdue && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
            <AlertCircle size={10} />
            Trễ hạn
          </span>
        )}
        {frozen && (
          <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={10} />
          </span>
        )}
      </div>

      {/* ── Row 2: Title & Description ── */}
      <div className="mt-1 min-h-0">
        <h3
          className={`line-clamp-1 text-xs font-bold leading-tight ${
            frozen ? 'text-slate-600' : 'text-slate-800'
          }`}
        >
          {task.title}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500">
          {task.description}
        </p>
      </div>

      {/* ── Row 3: Prerequisites & Artifacts ── */}
      <div className="mt-1 min-h-0 space-y-0.5">
        <div className="flex items-center gap-1 truncate rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
          {frozen ? <Lock size={10} /> : <Check size={10} />}
          <span className="truncate">{task.joinPolicySummary}</span>
        </div>
        {latest && (
          <a
            href={latest.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
          >
            <ExternalLink size={10} />
            <span className="truncate">{artifactLabel(latest)}</span>
          </a>
        )}
      </div>

      {/* ── Row 4: Footer ── */}
      <div className="mt-auto flex items-center justify-between gap-1 border-t border-slate-100 pt-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex shrink-0 items-center gap-1 text-[10px] font-medium ${
              task.isOverdue ? 'text-red-600' : 'text-slate-500'
            }`}
          >
            <Calendar size={11} />
            {fmtDayMonth(task.dueDate)}
          </span>
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${actor.avatarClass}`}
          >
            {actor.initials}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {task.status === 'TODO' &&
            actionBtn(
              'Bắt đầu',
              'IN_PROGRESS',
              'bg-blue-600 text-white hover:bg-blue-700',
              Play,
            )}
          {task.status === 'IN_PROGRESS' && (
            <>
              {actionBtn(
                'Hủy',
                'TODO',
                'bg-slate-100 text-slate-600 hover:bg-slate-200',
                Undo2,
              )}
              {actionBtn(
                'Nộp',
                'REVIEW',
                'bg-violet-600 text-white hover:bg-violet-700',
                Send,
              )}
            </>
          )}
          {task.status === 'REVIEW' &&
            (owner ? (
              <>
                {actionBtn(
                  'Làm lại',
                  'IN_PROGRESS',
                  'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  RotateCcw,
                )}
                {actionBtn(
                  'Duyệt',
                  'DONE',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                  Check,
                )}
              </>
            ) : (
              <span className="flex items-center gap-0.5 whitespace-nowrap text-[10px] font-medium text-violet-600">
                <Clock size={11} />
                Chờ duyệt
              </span>
            ))}
          {frozen && (
            <span className="whitespace-nowrap text-[10px] font-semibold text-emerald-600">
              Đã nghiệm thu
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
