import { produce } from 'immer'
import type {
  AuditLogItem,
  ChangeMemberRoleCommand,
  InviteMemberCommand,
  ProjectMemberDetail,
  ProjectInvitationDto,
  ProjectRole,
  ProjectSettingsDto,
  UpdateProjectCommand,
} from '../../types/settings.types'
import { workflowService } from '../../services/container'

export type SettingsLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SettingsSlice {
  settings: {
    settings: ProjectSettingsDto | null
    members: ProjectMemberDetail[]
    pendingInvitations: ProjectInvitationDto[]
    auditLogs: AuditLogItem[]
    simulatedRole: ProjectRole
    auditFilter: string
    searchQuery: string
    status: SettingsLoadStatus
    error: string | null
    isInviteModalOpen: boolean
    isDeleteModalOpen: boolean
    memberPendingKick: ProjectMemberDetail | null
    memberPendingDemote: ProjectMemberDetail | null
    kahnCycleErrors: string[] | null
    toast: string | null

    loadSettings: (projectId?: string) => Promise<void>
    setSimulatedRole: (role: ProjectRole) => void
    updateGeneralSettings: (cmd: UpdateProjectCommand) => Promise<boolean>
    publishProject: () => Promise<boolean>
    archiveProject: () => Promise<boolean>
    restoreProject: () => Promise<boolean>
    deleteProject: () => Promise<boolean>
    inviteMember: (cmd: InviteMemberCommand) => Promise<boolean>
    revokeInvitation: (invitationId: string) => Promise<boolean>
    acceptInvitation: (invitationId: string) => Promise<boolean>
    rejectInvitation: (invitationId: string) => Promise<boolean>
    changeRole: (userId: string, role: 'MANAGER' | 'COLLABORATOR' | 'VIEWER') => Promise<boolean>
    kickMember: (userId: string) => Promise<boolean>
    demoteMember: (userId: string) => Promise<boolean>
    setAuditFilter: (scope: string) => void
    setSearchQuery: (query: string) => void
    openInviteModal: () => void
    openDeleteModal: () => void
    closeDeleteModal: () => void
    setMemberPendingKick: (member: ProjectMemberDetail | null) => void
    setMemberPendingDemote: (member: ProjectMemberDetail | null) => void
    setKahnCycleErrors: (errors: string[] | null) => void
    closeModals: () => void
    showToast: (msg: string) => void
    addMockAuditLog: (log: { action: string; details: string; scope: string }) => void
  }
}

export const createSettingsSlice = (
  set: (update: (state: SettingsSlice) => SettingsSlice) => void,
  get: () => SettingsSlice,
): SettingsSlice => {
  const currentProjectId = () => get().settings.settings?.id || '1'

  const refreshLogs = async (projectId: string) => {
    try {
      const logs = await workflowService.getProjectAuditLogs(projectId)
      set((state) =>
        produce(state, (draft) => {
          draft.settings.auditLogs = logs
        }),
      )
    } catch {
      // Silently keep current logs on minor sync error
    }
  }

  return {
    settings: {
      settings: null,
      members: [],
      pendingInvitations: [],
      auditLogs: [],
      simulatedRole: 'OWNER',
      auditFilter: 'All Events',
      searchQuery: '',
      status: 'idle',
      error: null,
      isInviteModalOpen: false,
      isDeleteModalOpen: false,
      memberPendingKick: null,
      memberPendingDemote: null,
      kahnCycleErrors: null,
      toast: null,

      loadSettings: async (projectId = '1') => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.status = 'loading'
            draft.settings.error = null
          }),
        )

        try {
          const [settingsData, membersData, logsData, pendingData] = await Promise.all([
            workflowService.getProjectSettings(projectId),
            workflowService.getProjectMembersDetailed(projectId),
            workflowService.getProjectAuditLogs(projectId),
            workflowService.getProjectPendingInvitations ? workflowService.getProjectPendingInvitations(projectId) : Promise.resolve([]),
          ])

          set((state) =>
            produce(state, (draft) => {
              draft.settings.settings = settingsData
              draft.settings.members = membersData
              draft.settings.pendingInvitations = pendingData || []
              draft.settings.auditLogs = logsData
              draft.settings.status = 'ready'
            }),
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to load project settings'
          set((state) =>
            produce(state, (draft) => {
              draft.settings.status = 'error'
              draft.settings.error = msg
            }),
          )
        }
      },

      setSimulatedRole: (role: ProjectRole) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.simulatedRole = role
            if (draft.settings.settings) {
              draft.settings.settings.myRole = role
            }
          }),
        )
      },

      updateGeneralSettings: async (cmd: UpdateProjectCommand) => {
        const pid = currentProjectId()
        try {
          const updated = await workflowService.updateProjectSettings(pid, cmd)
          set((state) =>
            produce(state, (draft) => {
              draft.settings.settings = updated
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast('Project details saved.')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to save project settings'
          get().settings.showToast(msg)
          return false
        }
      },

      publishProject: async () => {
        const pid = currentProjectId()
        try {
          const result = await workflowService.publishPipeline(pid)
          if (result.cycleDetected || !result.success) {
            set((state) =>
              produce(state, (draft) => {
                draft.settings.kahnCycleErrors = result.violatingNodeIds || ['WPE-009', 'WPE-014', 'WPE-009']
              }),
            )
            return false
          }

          if (result.newStatus) {
            set((state) =>
              produce(state, (draft) => {
                if (draft.settings.settings) {
                  draft.settings.settings.status = result.newStatus!
                }
              }),
            )
          }

          await refreshLogs(pid)
          get().settings.showToast("Pipeline published successfully. Kahn's check passed.")
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Publish failed'
          get().settings.showToast(msg)
          return false
        }
      },

      archiveProject: async () => {
        const pid = currentProjectId()
        try {
          const updated = await workflowService.archiveProject(pid)
          set((state) =>
            produce(state, (draft: any) => {
              draft.settings.settings = updated
              if (draft.workspace?.projects) {
                draft.workspace.projects = draft.workspace.projects.map((p: any) =>
                  String(p.id) === String(pid) ? { ...p, status: 'ARCHIVED' } : p,
                )
              }
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast('Project has been archived and is now read-only.')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to archive project'
          get().settings.showToast(msg)
          return false
        }
      },

      restoreProject: async () => {
        const pid = currentProjectId()
        try {
          const updated = await workflowService.restoreProject(pid)
          set((state) =>
            produce(state, (draft: any) => {
              draft.settings.settings = updated
              if (draft.workspace?.projects) {
                draft.workspace.projects = draft.workspace.projects.map((p: any) =>
                  String(p.id) === String(pid) ? { ...p, status: 'ACTIVE' } : p,
                )
              }
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast('Project restored to ACTIVE.')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to restore project'
          get().settings.showToast(msg)
          return false
        }
      },

      deleteProject: async () => {
        const pid = currentProjectId()
        try {
          await workflowService.deleteProject(pid)
          set((state) =>
            produce(state, (draft: any) => {
              draft.settings.isDeleteModalOpen = false
              if (draft.workspace?.projects) {
                draft.workspace.projects = draft.workspace.projects.filter(
                  (p: any) => String(p.id) !== String(pid),
                )
              }
            }),
          )
          get().settings.showToast('Project deleted successfully.')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to delete project'
          get().settings.showToast(msg)
          return false
        }
      },

      openDeleteModal: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.isDeleteModalOpen = true
          }),
        )
      },

      closeDeleteModal: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.isDeleteModalOpen = false
          }),
        )
      },

      inviteMember: async (cmd: InviteMemberCommand) => {
        const pid = currentProjectId()
        try {
          let inviteDto: ProjectInvitationDto | null = null
          if (workflowService.createProjectInvitation) {
            inviteDto = await workflowService.createProjectInvitation(pid, cmd)
          }
          const newMember = await workflowService.inviteProjectMember(pid, cmd)
          set((state) =>
            produce(state, (draft) => {
              if (inviteDto) {
                draft.settings.pendingInvitations.unshift(inviteDto)
              }
              draft.settings.isInviteModalOpen = false
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast(`Invitation sent to ${newMember.email || cmd.usernameOrEmail}.`)
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to invite member'
          get().settings.showToast(msg)
          return false
        }
      },

      revokeInvitation: async (invitationId: string) => {
        const pid = currentProjectId()
        try {
          if (workflowService.revokeInvitation) {
            await workflowService.revokeInvitation(pid, invitationId)
          }
          set((state) =>
            produce(state, (draft) => {
              draft.settings.pendingInvitations = draft.settings.pendingInvitations.filter(
                (i) => i.id !== invitationId,
              )
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast('Invitation revoked.')
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to revoke invitation'
          get().settings.showToast(msg)
          return false
        }
      },

      acceptInvitation: async (invitationId: string) => {
        try {
          if (workflowService.acceptInvitation) {
            const res = await workflowService.acceptInvitation(invitationId)
            const pid = res.projectId || currentProjectId()
            await get().settings.loadSettings(pid)
            get().settings.showToast('You have joined the project!')
            return true
          }
          return false
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to accept invitation'
          get().settings.showToast(msg)
          return false
        }
      },

      rejectInvitation: async (invitationId: string) => {
        try {
          if (workflowService.rejectInvitation) {
            await workflowService.rejectInvitation(invitationId)
            get().settings.showToast('Invitation declined.')
            return true
          }
          return false
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to decline invitation'
          get().settings.showToast(msg)
          return false
        }
      },

      changeRole: async (userId: string, role: 'MANAGER' | 'COLLABORATOR' | 'VIEWER') => {
        const pid = currentProjectId()
        try {
          const updated = await workflowService.changeMemberRole(pid, userId, { role })
          set((state) =>
            produce(state, (draft) => {
              const idx = draft.settings.members.findIndex((m) => m.userId === userId)
              if (idx !== -1) {
                draft.settings.members[idx] = updated
              }
              draft.settings.memberPendingDemote = null
            }),
          )
          await refreshLogs(pid)
          get().settings.showToast(`${updated.username} is now ${role}.`)
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to change role'
          get().settings.showToast(msg)
          return false
        }
      },

      kickMember: async (userId: string) => {
        const pid = currentProjectId()
        const target = get().settings.members.find((m) => m.userId === userId)
        try {
          const res = await workflowService.removeProjectMember(pid, userId)
          set((state) =>
            produce(state, (draft) => {
              draft.settings.members = draft.settings.members.filter((m) => m.userId !== userId)
              draft.settings.memberPendingKick = null
            }),
          )
          await refreshLogs(pid)
          const name = target?.username || 'Member'
          const toastMsg = res.unassignedTaskCount > 0
            ? `${name} removed. ${res.unassignedTaskCount} task(s) unassigned.`
            : `${name} removed.`
          get().settings.showToast(toastMsg)
          return true
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to remove member'
          get().settings.showToast(msg)
          return false
        }
      },

      demoteMember: async (userId: string) => {
        return get().settings.changeRole(userId, 'VIEWER')
      },

      setAuditFilter: (scope: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.auditFilter = scope
          }),
        )
      },

      setSearchQuery: (query: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.searchQuery = query
          }),
        )
      },

      openInviteModal: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.isInviteModalOpen = true
          }),
        )
      },

      setMemberPendingKick: (member: ProjectMemberDetail | null) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.memberPendingKick = member
          }),
        )
      },

      setMemberPendingDemote: (member: ProjectMemberDetail | null) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.memberPendingDemote = member
          }),
        )
      },

      setKahnCycleErrors: (errors: string[] | null) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.kahnCycleErrors = errors
          }),
        )
      },

      closeModals: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.isInviteModalOpen = false
            draft.settings.isDeleteModalOpen = false
            draft.settings.memberPendingKick = null
            draft.settings.memberPendingDemote = null
            draft.settings.kahnCycleErrors = null
          }),
        )
      },

      showToast: (msg: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.toast = msg
          }),
        )
        setTimeout(() => {
          if (get().settings.toast === msg) {
            set((state) =>
              produce(state, (draft) => {
                draft.settings.toast = null
              }),
            )
          }
        }, 2600)
      },

      addMockAuditLog: (log) => {
        set((state) =>
          produce(state, (draft) => {
            draft.settings.auditLogs.unshift({
              id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              action: log.action as any,
              actor: {
                userId: 'user-1',
                name: 'Alex Kim',
                role: 'OWNER',
              },
              details: log.details,
              scope: log.scope as any,
              timestamp: new Date().toISOString(),
            })
          }),
        )
      },
    },
  }
}
