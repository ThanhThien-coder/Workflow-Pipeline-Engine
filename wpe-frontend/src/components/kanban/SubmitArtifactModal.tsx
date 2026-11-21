import { useCallback, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import type { ArtifactType, KanbanTask } from '../../types/kanban.types'
import { DELIVERABLE_NAME_MAX, isValidArtifactUrl } from '../../utils/artifactLabel'
import { useDismiss } from '../../hooks/useDismiss'
import { SiteIcon, hostOf, siteLabel } from '../common/SiteIcon'

export function SubmitArtifactModal({
  task,
  submitting,
  onClose,
  onSubmit,
}: {
  task: KanbanTask
  submitting: boolean
  onClose: () => void
  onSubmit: (form: { type?: ArtifactType; url: string; name: string }) => Promise<boolean>
}) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])
  useDismiss(true, close, [ref])

  const trimmedUrl = url.trim()
  const showSitePreview = isValidArtifactUrl(trimmedUrl) && Boolean(hostOf(trimmedUrl))

  const submit = async () => {
    if (trimmedUrl && !isValidArtifactUrl(trimmedUrl)) {
      setError('Please enter a valid URL (starting with http:// or https://).')
      return
    }
    await onSubmit({ url: trimmedUrl, name: trimmedUrl ? name.trim() : '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fade-in absolute inset-0 bg-slate-900/40" onMouseDown={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-label="Submit Deliverable"
        className="pop-in relative w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4 shrink-0">
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
        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">
            Deliverable URL <span className="text-xs font-normal text-slate-400">(Optional)</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setError('')
                }}
                placeholder="https://github.com/repo/pull/128 (Optional)"
                className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-slate-800 ${
                  error ? 'border-red-300 focus:ring-red-100' : 'border-slate-200'
                }`}
              />
              {showSitePreview && (
                <span
                  data-testid="submit-artifact-site-preview"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700"
                >
                  <SiteIcon url={trimmedUrl} size={14} />
                  <span>{siteLabel(trimmedUrl)}</span>
                </span>
              )}
            </div>
            {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Deliverable name <span className="text-xs font-normal text-slate-400">(Optional)</span>
            <input
              value={name}
              maxLength={DELIVERABLE_NAME_MAX}
              disabled={!trimmedUrl}
              onChange={(event) => setName(event.target.value)}
              placeholder={trimmedUrl ? 'e.g. Login screen design, API pull request' : 'Add a URL first'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Shown in the Artifacts list. Leave blank to use &quot;Artifact {task.code}&quot;.
            </span>
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
