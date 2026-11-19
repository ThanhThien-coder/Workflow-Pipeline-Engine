import { useEffect, useRef, useState } from 'react'

export interface RejectReasonModalProps {
  /** Mã task đang được trả lại (chỉ để hiển thị). */
  taskCode?: string
  submitting?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

/** Hộp nhập lý do khi kéo task từ Review về In Progress (backend bắt buộc có rejectReason). */
export function RejectReasonModal({ taskCode, submitting = false, onCancel, onConfirm }: RejectReasonModalProps) {
  const [reason, setReason] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const trimmed = reason.trim()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Esc chỉ đóng hộp này, không lan ra drawer / hộp chi tiết phía sau
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onCancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onMouseDown={(e) => e.stopPropagation()}>
      <div className="fade-in absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-reason-title"
        className="pop-in relative w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div>
          <h3 id="reject-reason-title" className="text-sm font-bold text-slate-900">Request changes</h3>
          <p className="text-[11px] text-slate-500">
            {taskCode ? `Move ${taskCode} back to In Progress.` : 'Move this task back to In Progress.'} Tell the assignee what needs to change.
          </p>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Reason <span className="text-rose-500">*</span>
          <textarea
            ref={inputRef}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What should be revised?"
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 focus:border-rose-300 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed || submitting}
            onClick={() => onConfirm(trimmed)}
            className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Request changes
          </button>
        </div>
      </div>
    </div>
  )
}
