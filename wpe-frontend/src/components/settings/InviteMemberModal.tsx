import { useState } from 'react'
import type { InviteMemberCommand } from '../../types/settings.types'
import { INVITE_ROLE_HINTS } from './rolePermissions'

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (cmd: InviteMemberCommand) => Promise<boolean>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** G22: chỉ mời bằng email (username có thể trùng). Trường lệnh vẫn tên usernameOrEmail để không đổi contract. */
export function InviteMemberModal({ isOpen, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'MANAGER' | 'COLLABORATOR' | 'VIEWER'>('COLLABORATOR')
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  if (!isOpen) return null

  const trimmed = email.trim()
  const emailError = touched && trimmed && !EMAIL_RE.test(trimmed) ? 'Enter a valid email address.' : null

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (!trimmed || !EMAIL_RE.test(trimmed) || submitting) return

    setSubmitting(true)
    try {
      const ok = await onInvite({ usernameOrEmail: trimmed, role })
      if (ok) {
        setEmail('')
        setTouched(false)
        setRole('COLLABORATOR')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full text-sm py-2 px-3 rounded-lg border border-slate-200 bg-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 pb-2.5">
          <h3 className="text-base font-bold text-slate-800">Invite Member</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Invite a new team member to collaborate on this pipeline.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div>
            <label htmlFor="invite-member-email" className="text-xs font-semibold text-slate-600">Email</label>
            <input
              id="invite-member-email"
              type="email"
              autoFocus
              autoComplete="off"
              className={`${inputCls} mt-1`}
              placeholder="e.g. alex.kim@acme.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {emailError && <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">{emailError}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Workspace role</label>
            <select
              className={`${inputCls} mt-1`}
              value={role}
              onChange={(e) => setRole(e.target.value as 'MANAGER' | 'COLLABORATOR' | 'VIEWER')}
            >
              <option value="MANAGER">MANAGER ({INVITE_ROLE_HINTS.MANAGER})</option>
              <option value="COLLABORATOR">COLLABORATOR ({INVITE_ROLE_HINTS.COLLABORATOR})</option>
              <option value="VIEWER">VIEWER ({INVITE_ROLE_HINTS.VIEWER})</option>
            </select>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmed || Boolean(emailError) || submitting}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
