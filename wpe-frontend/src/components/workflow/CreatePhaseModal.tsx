import { X } from 'lucide-react'
import { useState } from 'react'
import type { CreatePhaseDto } from '../../services/contracts/IWorkflowService'
import type { MacroPhase } from '../../types/workflow.types'

export function CreatePhaseModal({
  phases,
  onSubmit,
  onClose,
}: {
  phases: MacroPhase[]
  onSubmit: (dto: CreatePhaseDto) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [sub, setSub] = useState('')
  const [parentPhaseId, setParentPhaseId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !sub.trim()) {
      setError('Please enter phase name and subtitle.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        sub: sub.trim(),
        parentPhaseId: parentPhaseId || undefined,
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create phase.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-slate-900/20 backdrop-blur-xs p-4"
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Create New Phase</h2>
            <p className="mt-0.5 text-xs text-slate-400">Add a new cluster to the Macro Pipeline</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <label className="mb-3 block text-xs font-semibold text-slate-600">
          Phase Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. PHASE 4"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            autoFocus
          />
        </label>

        <label className="mb-3 block text-xs font-semibold text-slate-600">
          Subtitle
          <input
            value={sub}
            onChange={(event) => setSub(event.target.value)}
            placeholder="e.g. Operations & Monitoring"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-600">
          Prerequisite Phase
          <select
            value={parentPhaseId}
            onChange={(event) => setParentPhaseId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">None (Root phase)</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name} · {phase.sub}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create Phase'}
          </button>
        </div>
      </form>
    </div>
  )
}
