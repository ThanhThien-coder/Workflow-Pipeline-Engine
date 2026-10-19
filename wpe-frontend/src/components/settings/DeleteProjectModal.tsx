import { useState, useRef } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useDismiss } from '../../hooks/useDismiss'

interface DeleteProjectModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirmDelete: () => Promise<boolean>
}

export function DeleteProjectModal({
  isOpen,
  projectName,
  onClose,
  onConfirmDelete,
}: DeleteProjectModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useDismiss(isOpen, () => {
    if (!deleting) {
      setConfirmText('')
      onClose()
    }
  }, [modalRef])

  if (!isOpen) return null

  const isMatch = confirmText.trim() === projectName.trim()

  const handleDelete = async () => {
    if (!isMatch || deleting) return
    setDeleting(true)
    try {
      const ok = await onConfirmDelete()
      if (ok) {
        setConfirmText('')
        onClose()
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    if (deleting) return
    setConfirmText('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 text-red-600">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="delete-project-title" className="text-base font-bold text-slate-900">
                Delete Project
              </h3>
              <p className="text-xs text-slate-500">Irreversible destructive action</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-red-200/80 bg-red-50/60 p-3.5 text-xs text-red-800 leading-relaxed">
          This action <b>cannot be undone</b>. This will permanently delete the{' '}
          <span className="font-bold underline">{projectName}</span> pipeline, including all DAG nodes,
          Kanban task cards, uploaded artifacts, and access permissions.
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600">
            To confirm, type <span className="font-bold text-slate-900 select-all">{projectName}</span> below:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            placeholder={projectName}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
            autoFocus
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Trash2 size={13} />
            <span>{deleting ? 'Deleting Project...' : 'I understand, delete this project'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

