import { useEffect } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { SettingsHeader } from '../settings/SettingsHeader'
import { GeneralSettingsSection } from '../settings/GeneralSettingsSection'
import { WorkspaceMembersSection } from '../settings/WorkspaceMembersSection'
import { ProjectResourcesSection } from '../settings/ProjectResourcesSection'
import { SystemAuditLogSection } from '../settings/SystemAuditLogSection'
import { InviteMemberModal } from '../settings/InviteMemberModal'
import { KickMemberModal } from '../settings/KickMemberModal'
import { KahnCycleModal } from '../settings/KahnCycleModal'

export function SettingsView() {
  const {
    settings,
    members,
    auditLogs,
    simulatedRole,
    auditFilter,
    searchQuery,
    status,
    error,
    isInviteModalOpen,
    memberPendingKick,
    memberPendingDemote,
    kahnCycleErrors,
    toast,
    loadSettings,
    updateGeneralSettings,
    publishProject,
    inviteMember,
    changeRole,
    kickMember,
    demoteMember,
    setAuditFilter,
    setSearchQuery,
    openInviteModal,
    setMemberPendingKick,
    setMemberPendingDemote,
    setKahnCycleErrors,
    closeModals,
  } = useWorkflowStore((state) => state.settings)

  const setDevProjectStatus = useWorkflowStore((state) => state.dev.setDevProjectStatus)

  useEffect(() => {
    if (status === 'idle') {
      void loadSettings('1')
    }
  }, [status, loadSettings])

  if (status === 'loading' && !settings) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-sm text-slate-500">
        Loading Project Settings…
      </div>
    )
  }

  if (status === 'error' && !settings) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-sm text-red-600">
        {error || 'Failed to load project settings'}
      </div>
    )
  }

  const effectiveRole = settings?.myRole || simulatedRole

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <SettingsHeader myRole={effectiveRole} />

        <GeneralSettingsSection
          settings={settings}
          myRole={effectiveRole}
          onSave={updateGeneralSettings}
          onPublish={() => publishProject()}
          onRestore={() => setDevProjectStatus('ACTIVE')}
        />

        <ProjectResourcesSection />

        <WorkspaceMembersSection
          members={members}
          simulatedRole={effectiveRole}
          onOpenInvite={openInviteModal}
          onRoleChange={changeRole}
          onPromptDemote={setMemberPendingDemote}
          onPromptKick={setMemberPendingKick}
        />

        <SystemAuditLogSection
          logs={auditLogs}
          filterScope={auditFilter}
          searchQuery={searchQuery}
          onFilterScopeChange={setAuditFilter}
          onSearchQueryChange={setSearchQuery}
        />
      </div>

      {/* Modals */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={closeModals}
        onInvite={inviteMember}
      />

      <KickMemberModal
        member={memberPendingKick}
        isDemote={false}
        onClose={closeModals}
        onConfirm={async () => {
          if (!memberPendingKick) return false
          return kickMember(memberPendingKick.userId)
        }}
      />

      <KickMemberModal
        member={memberPendingDemote}
        isDemote={true}
        onClose={closeModals}
        onConfirm={async () => {
          if (!memberPendingDemote) return false
          return demoteMember(memberPendingDemote.userId)
        }}
      />

      <KahnCycleModal
        violatingNodeIds={kahnCycleErrors}
        onClose={() => setKahnCycleErrors(null)}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-pop-in">
          {toast}
        </div>
      )}
    </div>
  )
}
export default SettingsView
