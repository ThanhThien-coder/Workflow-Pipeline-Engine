import { ClipboardCheck, Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'
import type { KanbanTask, UserSummary } from '../../types/kanban.types'

/** Số trên huy hiệu: tối đa "9+". */
export function formatBadgeCount(count: number): string {
  return count > 9 ? '9+' : String(count)
}

/**
 * G18: nút "Chờ duyệt" ở My Tasks (chỉ chủ dự án / quản lý). Huy hiệu đếm số task đang chờ duyệt;
 * bấm mở danh sách, bấm một task thì báo onOpenTask để mở hộp chi tiết task như cũ.
 */
export function ReviewQueueButton({
  tasks,
  members,
  loading = false,
  error = false,
  onOpen,
  onOpenTask,
}: {
  tasks: KanbanTask[]
  members: UserSummary[]
  loading?: boolean
  error?: boolean
  /** Mở danh sách: tải lại cho mới. */
  onOpen?: () => void
  onOpenTask: (task: KanbanTask) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, [wrapperRef])

  const count = tasks.length
  const nameOf = (userId: string | null | undefined) =>
    !userId ? 'Chưa giao' : members.find((member) => member.id === userId)?.name ?? 'Thành viên khác'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `Chờ duyệt: ${count} task` : 'Chờ duyệt'}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) onOpen?.()
        }}
        className={`relative flex items-center gap-2 rounded-full border bg-white py-2 pl-3 pr-4 text-xs font-semibold shadow-xs transition hover:border-violet-300 hover:text-violet-700 ${
          open ? 'border-violet-300 text-violet-700 ring-2 ring-violet-100' : 'border-slate-200 text-slate-700'
        }`}
      >
        <ClipboardCheck size={15} className="text-violet-600" />
        Chờ duyệt
        {count > 0 && (
          <span
            data-testid="review-badge"
            className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {formatBadgeCount(count)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Danh sách task chờ duyệt"
          className="absolute right-0 top-full z-40 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <b className="text-sm text-slate-900">Task chờ duyệt</b>
            <span className="text-[11px] text-slate-500">{count} task</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading && !count ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" /> Đang tải…
              </div>
            ) : error && !count ? (
              <div className="py-8 text-center text-xs text-rose-600">Không tải được danh sách chờ duyệt.</div>
            ) : !count ? (
              <div className="py-8 text-center text-xs text-slate-400">Không có task nào chờ duyệt.</div>
            ) : (
              <ul className="flex flex-col gap-1">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onOpenTask(task)
                      }}
                      className="flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left transition hover:bg-violet-50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-slate-400">{task.code}</span>
                        {task.phaseLabel && (
                          <span className="max-w-[170px] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {task.phaseLabel}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs font-bold text-slate-800">{task.title}</span>
                      <span className="text-[11px] text-slate-500">Người nộp: {nameOf(task.assignedUserId)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
