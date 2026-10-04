import { AlertTriangle } from 'lucide-react'
import type { ProjectMemberDetail } from '../../types/settings.types'

interface KickMemberModalProps {
  member: ProjectMemberDetail | null
  isDemote?: boolean
  onClose: () => void
  onConfirm: () => Promise<boolean>
}

export function KickMemberModal({
  member,
  isDemote = false,
  onClose,
  onConfirm,
}: KickMemberModalProps) {
  if (!member) return null

  const title = isDemote ? 'Change role to VIEWER?' : 'Remove member?'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">
              Target member: <strong className="text-slate-700">{member.username}</strong> ({member.email})
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50/60 p-3.5 text-xs leading-relaxed text-slate-700">
          {member.activeNodeCount > 0 ? (
            <p>
              <strong className="text-red-700">Warning:</strong> {member.username} is currently assigned to{' '}
              <strong className="font-bold text-red-700">{member.activeNodeCount} active tasks</strong>.{' '}
              {isDemote ? 'Changing this role to VIEWER' : 'Removing this member'} will unassign all their tasks and
              revert in-progress tasks back to To Do.
            </p>
          ) : (
            <p>
              Are you sure you want to {isDemote ? 'demote' : 'remove'} <strong>{member.username}</strong>? They will
              have read-only permissions and cannot be assigned tasks.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            {isDemote ? 'Confirm Change' : 'Confirm Removal'}
          </button>
        </div>
      </div>
    </div>
  )
}
