import { useState } from 'react'
import { Archive, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'

interface DangerZoneSectionProps {
  isArchived: boolean
  isOwner: boolean
  onArchive: () => Promise<boolean>
  onRestore: () => Promise<boolean>
  onOpenDeleteModal: () => void
}

export function DangerZoneSection({
  isArchived,
  isOwner,
  onArchive,
  onRestore,
  onOpenDeleteModal,
}: DangerZoneSectionProps) {
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  if (!isOwner) return null

  const handleArchiveToggle = async () => {
    if (isArchived) {
      if (restoring) return
      setRestoring(true)
      try {
        await onRestore()
      } finally {
        setRestoring(false)
      }
    } else {
      if (archiving) return
      setArchiving(true)
      try {
        await onArchive()
      } finally {
        setArchiving(false)
      }
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50/40 px-5 py-3">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <div>
          <h2 className="text-sm font-bold text-red-900">Danger Zone</h2>
          <p className="text-[11px] text-red-600/80">
            Irreversible and destructive actions for this project.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {/* Archive / Restore Row */}
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h3 className="text-xs font-bold text-slate-800">
              {isArchived ? 'Restore this project' : 'Archive this project'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              {isArchived
                ? 'This project is currently archived and locked in read-only mode. Restoring it will reactivate the pipeline and allow members to resume work.'
                : 'Mark this project as archived and read-only. Members will not be able to move tasks, edit nodes, or submit deliverables.'}
            </p>
          </div>

          <button
            type="button"
            disabled={archiving || restoring}
            onClick={handleArchiveToggle}
            className={`flex items-center gap-1.5 self-start whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition disabled:opacity-40 sm:self-center ${
              isArchived
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}
            <span>
              {isArchived
                ? restoring
                  ? 'Restoring...'
                  : 'Restore to Active'
                : archiving
                  ? 'Archiving...'
                  : 'Archive Project'}
            </span>
          </button>
        </div>

        {/* Delete Row */}
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h3 className="text-xs font-bold text-slate-800">Delete this project</h3>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Once you delete a project, all associated graph nodes, Kanban tasks, uploaded artifacts, and member assignments will be permanently removed. There is no going back.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenDeleteModal}
            className="flex items-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-red-300 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 shadow-2xs transition hover:bg-red-600 hover:text-white sm:self-center"
          >
            <Trash2 size={13} />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </section>
  )
}

