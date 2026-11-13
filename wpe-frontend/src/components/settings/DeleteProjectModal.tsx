import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useDismiss } from '../../hooks/useDismiss'

interface DeleteProjectModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirmDelete: () => Promise<boolean | void>
  errorMessage?: string | null
}

export function DeleteProjectModal({
  isOpen,
  projectName,
  onClose,
  onConfirmDelete,
  errorMessage,
}: DeleteProjectModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setLocalError(null)
      setDeleting(false)
    }
  }, [isOpen])

  useDismiss(isOpen, () => {
    if (!deleting) {
      setLocalError(null)
      onClose()
    }
  }, [modalRef])

  if (!isOpen) return null

  const displayError = localError || errorMessage

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setLocalError(null)
    try {
      const ok = await onConfirmDelete()
      if (ok !== false) {
        onClose()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa dự án'
      setLocalError(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    if (deleting) return
    setLocalError(null)
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
                Xóa dự án
              </h3>
              <p className="text-xs text-slate-500">Hành động xóa vĩnh viễn</p>
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
          Hành động này <b>Không thể hoàn tác</b>. Dự án{' '}
          <strong className="font-bold text-slate-900 underline">{projectName}</strong> cùng toàn bộ
          giai đoạn, công việc (DAG nodes), tài nguyên minh chứng và phân quyền thành viên sẽ bị xóa
          vĩnh viễn.
        </div>

        {displayError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {displayError}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={13} />
            <span>{deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
