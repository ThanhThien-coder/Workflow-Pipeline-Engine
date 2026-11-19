import { AlertTriangle, Lock, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { KanbanTask, ReopenImpact } from '../../types/kanban.types'

export interface ReopenTaskModalProps {
  task: Pick<KanbanTask, 'id' | 'code' | 'title'>
  /** Tải danh sách task con bị ảnh hưởng (GET reopen-impact). */
  loadImpact: () => Promise<ReopenImpact>
  /** Gửi lý do mở lại; trả true khi thành công (hộp tự đóng). */
  onConfirm: (reason: string) => Promise<boolean>
  onClose: () => void
}

const STARTED = new Set(['IN_PROGRESS', 'REVIEW', 'DONE'])
const STATUS_LABELS: Record<string, string> = {
  LOCKED: 'Locked', TODO: 'To Do', IN_PROGRESS: 'In Progress', REVIEW: 'In Review', DONE: 'Done',
}

/**
 * S04: hộp xác nhận mở lại task đã Done. Liệt kê task con (con nào sẽ bị khóa lại, con nào đã bắt đầu
 * nên giữ nguyên) và bắt buộc nhập lý do trước khi mở lại.
 */
export function ReopenTaskModal({ task, loadImpact, onConfirm, onClose }: ReopenTaskModalProps) {
  const [impact, setImpact] = useState<ReopenImpact | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadImpact()
      .then((data) => { if (!cancelled) setImpact(data) })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error && err.message ? err.message : 'Could not load the affected tasks.') })
    return () => { cancelled = true }
    // loadImpact đổi tham chiếu mỗi lần render ở nơi gọi; chỉ tải lại khi đổi task
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  // Escape chỉ đóng hộp này, không đóng cả hộp chi tiết phía sau
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const children = impact?.children ?? []
  const started = children.filter((c) => STARTED.has(c.status))
  const relocked = children.filter((c) => c.willRelock)

  const handleConfirm = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Please enter a reason for reopening this task.')
      return
    }
    setBusy(true)
    try {
      const ok = await onConfirm(trimmed)
      if (ok) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onMouseDown={(e) => e.stopPropagation()}>
      <div className="fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reopen-modal-title"
        className="pop-in relative max-h-[88vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 id="reopen-modal-title" className="text-sm font-bold text-slate-900">Reopen task</h3>
              <p className="text-[11px] text-slate-500">Move {task.code} back to In Progress</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          The assignee gets the task back and is notified. Existing artifacts are kept and marked “Before reopen”.
        </p>

        <div className="space-y-2" data-testid="reopen-impact">
          <span className="text-xs font-semibold text-slate-700">Tasks that depend on {task.code}</span>
          {!impact && !loadError && <p className="text-[11px] text-slate-500">Loading…</p>}
          {loadError && <p className="text-[11px] font-semibold text-rose-600">{loadError}</p>}
          {impact && children.length === 0 && <p className="text-[11px] text-slate-500">No other task depends on this one.</p>}
          {children.length > 0 && (
            <ul className="space-y-1.5">
              {children.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-slate-800"><span className="font-semibold">{c.code}</span> {c.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">{STATUS_LABELS[c.status] ?? c.status}</span>
                    {c.willRelock && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"><Lock size={10} />Will be locked again</span>
                    )}
                    {STARTED.has(c.status) && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Already started</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {relocked.length > 0 && (
            <p className="text-[11px] text-slate-500">{relocked.length} task(s) in To Do will return to Locked until {task.code} is done again.</p>
          )}
          {started.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900" role="alert">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <span>{started.length} dependent task(s) already started ({started.map((c) => c.code).join(', ')}). They keep their current status; you may want to check them after the rework.</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="reopen-reason" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Reason <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="reopen-reason"
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonError('') }}
            placeholder="e.g. The delivered result missed the agreed requirements..."
            className={`w-full rounded-xl border p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none ${
              reasonError ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'
            }`}
          />
          {reasonError && <p className="mt-1.5 text-[11px] font-semibold text-rose-600">{reasonError}</p>}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Reopen
          </button>
        </div>
      </div>
    </div>
  )
}
