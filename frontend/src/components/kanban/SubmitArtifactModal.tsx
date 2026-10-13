import { useCallback, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import type { ArtifactType, KanbanTask } from '../../types/kanban.types'
import { ARTIFACT_TYPE_OPTIONS, isValidArtifactUrl } from '../../utils/artifactLabel'
import { useDismiss } from '../../hooks/useDismiss'

export function SubmitArtifactModal({
  task,
  submitting,
  onClose,
  onSubmit,
}: {
  task: KanbanTask
  submitting: boolean
  onClose: () => void
  onSubmit: (form: { type: ArtifactType; url: string; note: string }) => Promise<boolean>
}) {
  const [type, setType] = useState<ArtifactType>('PR')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])
  useDismiss(true, close, [ref])

  const submit = async () => {
    const trimmed = url.trim()
    if (trimmed && !isValidArtifactUrl(trimmed)) {
      setError('Please enter a valid URL (starting with http:// or https://).')
      return
    }
    await onSubmit({ type, url: trimmed, note })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fade-in absolute inset-0 bg-slate-900/40" onMouseDown={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-label="Submit Deliverable"
        className="pop-in relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Submit Deliverable (Artifact)</h2>
            <p className="mt-1 text-xs text-slate-500">
              <b className="font-mono">{task.code}</b> · {task.title}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Deliverable Type <span className="text-xs font-normal text-slate-400">(Tùy chọn / Optional)</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ArtifactType)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            >
              {ARTIFACT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Deliverable URL <span className="text-xs font-normal text-slate-400">(Tùy chọn / Optional)</span>
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError('')
              }}
              placeholder="https://github.com/repo/pull/128 (Optional)"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-800 ${
                error ? 'border-red-300 focus:ring-red-100' : 'border-slate-200'
              }`}
            />
            {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Handover Notes
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Summary of completed deliverables and changes..."
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 rounded-b-2xl bg-slate-50/70 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Upload size={14} />
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </button>
        </footer>
      </div>
    </div>
  )
}
