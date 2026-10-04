import { useState, useEffect, type FC, type KeyboardEvent } from 'react'
import { StatusBadge } from '../common/StatusBadge'

interface CreatePipelineModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; desc: string }) => Promise<void>
}

export const CreatePipelineModal: FC<CreatePipelineModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErr('Pipeline name is required.')
      return
    }

    setSubmitting(true)
    try {
      await onCreate({ name: name.trim(), desc: desc.trim() })
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="pop w-full max-w-lg rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Create New Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set up a deterministic workflow pipeline with DAG constraints.
            </p>
          </div>
          <StatusBadge status="DRAFT" />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800">
            Pipeline Name <span className="text-rose-500">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (err) setErr('')
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="e.g. Authentication Service V2"
            className={`mt-1.5 w-full text-sm rounded-xl border bg-white px-3.5 py-2.5 outline-none transition-colors ${
              err ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200/90 focus:border-indigo-500'
            }`}
          />
          {err && <p className="mt-1 text-[11px] font-medium text-rose-600 fade">{err}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-800">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe the goal of this workflow"
            className="mt-1.5 w-full text-sm rounded-xl border border-slate-200/90 bg-white focus:border-indigo-500 px-3.5 py-2.5 outline-none resize-none transition-colors"
          />
        </div>

        <p className="text-[11px] text-slate-500">
          New pipelines start as <b>DRAFT</b> and are published after Kahn&apos;s cycle check passes.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="btn-primary-gradient text-sm font-semibold text-white rounded-xl px-4 py-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Pipeline ➔'}
          </button>
        </div>
      </div>
    </div>
  )
}
