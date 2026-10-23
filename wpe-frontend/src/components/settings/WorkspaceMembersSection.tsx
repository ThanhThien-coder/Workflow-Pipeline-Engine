import { Clock, Mail, Trash2, UserPlus, UserX } from 'lucide-react'
import type { ProjectInvitationDto, ProjectMemberDetail, ProjectRole } from '../../types/settings.types'

interface WorkspaceMembersSectionProps {
  members: ProjectMemberDetail[]
  pendingInvitations?: ProjectInvitationDto[]
  simulatedRole: ProjectRole
  onOpenInvite: () => void
  onRoleChange: (userId: string, role: 'COLLABORATOR' | 'VIEWER') => void
  onPromptDemote: (member: ProjectMemberDetail) => void
  onPromptKick: (member: ProjectMemberDetail) => void
  onRevokeInvitation?: (invitationId: string) => void
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COLLABORATOR: 'bg-blue-50 text-blue-700 border-blue-200',
  VIEWER: 'bg-slate-100 text-slate-600 border-slate-200',
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export function WorkspaceMembersSection({
  members,
  pendingInvitations = [],
  simulatedRole,
  onOpenInvite,
  onRoleChange,
  onPromptDemote,
  onPromptKick,
  onRevokeInvitation,
}: WorkspaceMembersSectionProps) {
  const isOwner = simulatedRole === 'OWNER'

  const handleRoleSelect = (member: ProjectMemberDetail, targetRole: 'COLLABORATOR' | 'VIEWER') => {
    if (targetRole === member.role) return
    if (targetRole === 'VIEWER' && member.activeNodeCount > 0) {
      onPromptDemote(member)
      return
    }
    onRoleChange(member.userId, targetRole)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Workspace Members</h2>
          <p className="mt-0.5 text-xs text-slate-500">People with access to this pipeline.</p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={onOpenInvite}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <UserPlus size={14} />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      <div className="overflow-auto max-h-[350px] p-2 pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar]:h-1.5">
        <table className="w-full min-w-[580px] text-left">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5 border-b border-slate-100">Member</th>
              <th className="px-3 py-2.5 border-b border-slate-100">Role</th>
              <th className="px-3 py-2.5 border-b border-slate-100">Active Nodes</th>
              <th className="px-3 py-2.5 border-b border-slate-100">Joined</th>
              {isOwner && <th className="px-3 py-2.5 border-b border-slate-100 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {members.map((member) => (
              <tr key={member.userId} className="transition-colors hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white shadow-xs ${
                          member.avatarClass || 'bg-slate-400'
                        }`}
                      >
                        {member.initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-800">{member.username}</div>
                      <div className="truncate text-[11px] text-slate-400">{member.email}</div>
                    </div>
                  </div>
                </td>

                <td className="px-3 py-2.5">
                  {isOwner && member.role !== 'OWNER' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleSelect(member, e.target.value as 'COLLABORATOR' | 'VIEWER')}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="COLLABORATOR">COLLABORATOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        ROLE_BADGE[member.role] || ROLE_BADGE.VIEWER
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-600">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                      member.activeNodeCount > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
                    }`}
                  >
                    {member.activeNodeCount} active node{member.activeNodeCount === 1 ? '' : 's'}
                  </span>
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                  {formatDate(member.joinedAt)}
                </td>

                {isOwner && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {member.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => onPromptKick(member)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <UserX size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations Sub-Section */}
      {pendingInvitations.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Mail size={15} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800">Pending Invitations</h3>
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {pendingInvitations.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2">Invitee Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Expires</th>
                  {isOwner && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-100/60 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span>{inv.inviteeEmail}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[inv.role] || ROLE_BADGE.VIEWER}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(inv.expiresAt)}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onRevokeInvitation?.(inv.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 size={11} />
                          <span>Revoke</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
