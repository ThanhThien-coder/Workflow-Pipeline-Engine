import { useEffect, useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import type { ProjectRole, ProjectSettingsDto, UpdateProjectCommand } from '../../types/settings.types'

interface GeneralSettingsSectionProps {
  settings: ProjectSettingsDto | null
  myRole: ProjectRole
  onSave: (cmd: UpdateProjectCommand) => Promise<boolean>
  onPublish: () => Promise<boolean>
  onRestore?: () => Promise<void>
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  ARCHIVED: 'bg-red-50 text-red-700 border-red-200',
}

export function GeneralSettingsSection({
  settings,
  myRole,
  onSave,
  onPublish,
  onRestore,
}: GeneralSettingsSectionProps) {
  const isOwner = myRole === 'OWNER'
  const isArchived = settings?.status === 'ARCHIVED'
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name,
        description: settings.description,
      })
    }
  }, [settings])

  if (!settings) return null

  const isDirty = form.name !== settings.name || form.description !== settings.description
  const canEdit = isOwner && !isArchived

  const handleSave = async () => {
    if (!canEdit || !isDirty || saving) return
    setSaving(true)
    try {
      await onSave({ name: form.name.trim(), description: form.description.trim() })
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!isOwner || settings.status !== 'DRAFT' || publishing) return
    setPublishing(true)
    try {
      await onPublish()
    } finally {
      setPublishing(false)
    }
  }

  const handleRestore = async () => {
    if (!isOwner || !onRestore || restoring) return
    setRestoring(true)
    try {
      await onRestore()
    } finally {
      setRestoring(false)
    }
  }

  const inputCls =
    'w-full text-sm py-2 px-3 rounded-lg border border-slate-200 bg-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200'

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 pb-3 pt-4">
        <h2 className="text-sm font-bold text-slate-800">General</h2>
        <p className="mt-0.5 text-xs text-slate-500">Basic information about this pipeline.</p>
      </div>

      <div className="space-y-4 p-5">
        {isArchived && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800 animate-fade-in">
            <Archive className="h-4 w-4 shrink-0 text-red-600" />
            <span>
              This project is currently archived. All configurations and modifications are locked in read-only mode.
            </span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-600">Project name</label>
          <input
            className={`${inputCls} mt-1`}
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Marketing Campaign Q4"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Description</label>
          <textarea
            rows={3}
            className={`${inputCls} mt-1 resize-none`}
            value={form.description}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Provide context or description for this pipeline..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Lifecycle status</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
                STATUS_BADGE[settings.status] || STATUS_BADGE.DRAFT
              }`}
            >
              {settings.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isArchived && isOwner && onRestore && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw size={13} />
                <span>{restoring ? 'Restoring...' : 'Restore to Active'}</span>
              </button>
            )}

            {isOwner && settings.status === 'DRAFT' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="whitespace-nowrap rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40"
              >
                {publishing ? 'Publishing...' : 'Publish Pipeline'}
              </button>
            )}

            <button
              type="button"
              disabled={!canEdit || !isDirty || saving}
              onClick={handleSave}
              className="whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
