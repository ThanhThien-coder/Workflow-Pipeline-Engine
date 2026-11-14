import { useEffect } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { isMockMode } from '../../services/env'
import { SettingsHeader } from '../settings/SettingsHeader'
import { GeneralSettingsSection } from '../settings/GeneralSettingsSection'
import { WorkspaceMembersSection } from '../settings/WorkspaceMembersSection'
import { ProjectResourcesSection } from '../settings/ProjectResourcesSection'
import { SystemAuditLogSection } from '../settings/SystemAuditLogSection'
import { DangerZoneSection } from '../settings/DangerZoneSection'
import { InviteMemberModal } from '../settings/InviteMemberModal'
import { KickMemberModal } from '../settings/KickMemberModal'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import { DeleteProjectModal } from '../settings/DeleteProjectModal'

interface SettingsViewProps {
  projectId?: string
}

export function SettingsView({ projectId = '1' }: SettingsViewProps) {
  const { navigate } = useRouter()
  const {
    settings,
    members,
    memberHistory,
    pendingInvitations,
    auditLogs,
    simulatedRole,
    auditFilter,
    searchQuery,
    status,
    error,
    isInviteModalOpen,
    isDeleteModalOpen,
    memberPendingKick,
    memberPendingDemote,
    kahnCycleErrors,
    toast,
    loadSettings,
    updateGeneralSettings,
    publishProject,
    archiveProject,
    restoreProject,
    deleteProject,
    inviteMember,
    revokeInvitation,
    changeRole,
    kickMember,
    demoteMember,
    setAuditFilter,
    setSearchQuery,
    openInviteModal,
    openDeleteModal,
    closeDeleteModal,
    setMemberPendingKick,
    setMemberPendingDemote,
    setKahnCycleErrors,
    closeModals,
  } = useWorkflowStore((state) => state.settings)
  const currentUserId = useWorkflowStore((state) => state.auth.currentUser?.id ?? null)

  // Mỗi lần mở màn Settings, đổi dự án hoặc đổi người đăng nhập đều tải lại từ backend.
  // Trước đây chỉ tải khi status 'idle' hoặc khác dự án, nên quay lại đúng dự án cũ thì dùng dữ liệu cũ
  // (quyền của tài khoản trước, nhật ký chưa cập nhật).
  // Chế độ API mà chưa đăng nhập (đang đăng xuất) thì không tải: request không có token sẽ rơi về user debug.
  useEffect(() => {
    if (!isMockMode && !currentUserId) return
    void loadSettings(projectId)
  }, [loadSettings, projectId, currentUserId])

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
  const isOwner = effectiveRole === 'OWNER'
  const isArchived = settings?.status === 'ARCHIVED'

  const handleConfirmDelete = async () => {
    const ok = await deleteProject()
    if (ok) {
      navigate('/workspaces')
      return true
    }
    return false
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <SettingsHeader myRole={effectiveRole} />

        <GeneralSettingsSection
          projectId={projectId}
          settings={settings}
          myRole={effectiveRole}
          onSave={updateGeneralSettings}
          onPublish={() => publishProject(projectId)}
          onRestore={async () => {
            await restoreProject()
          }}
        />

        <ProjectResourcesSection projectId={projectId} />

        <WorkspaceMembersSection
          members={members}
          memberHistory={memberHistory}
          pendingInvitations={pendingInvitations}
          simulatedRole={effectiveRole}
          onOpenInvite={openInviteModal}
          onRoleChange={changeRole}
          onPromptDemote={setMemberPendingDemote}
          onPromptKick={setMemberPendingKick}
          onRevokeInvitation={revokeInvitation}
        />

        <SystemAuditLogSection
          logs={auditLogs}
          filterScope={auditFilter}
          searchQuery={searchQuery}
          onFilterScopeChange={setAuditFilter}
          onSearchQueryChange={setSearchQuery}
        />

        {/* Danger Zone: Only accessible to Project Owners */}
        {isOwner && (
          <DangerZoneSection
            isArchived={isArchived}
            isOwner={isOwner}
            onArchive={archiveProject}
            onRestore={restoreProject}
            onOpenDeleteModal={openDeleteModal}
          />
        )}
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

      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        projectName={settings?.name || 'Project'}
        onClose={closeDeleteModal}
        onConfirmDelete={handleConfirmDelete}
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
