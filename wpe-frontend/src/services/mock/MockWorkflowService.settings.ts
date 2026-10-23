import type { IWorkflowService } from '../contracts/IWorkflowService'
import type {
  ProjectSettingsDto,
  ProjectMemberDetail,
  ProjectInvitationDto,
  AuditLogItem,
  UpdateProjectCommand,
  InviteMemberCommand,
  ChangeMemberRoleCommand,
  PublishPipelineResult,
  AuditLogAction,
  AuditScope,
  ProjectRole,
  ProjectStatus,
} from '../../types/settings.types'
import { MockConfig, mockDelay } from './MockConfig'
import { getSavedAvatar } from '../../utils/avatarUtils'

const INITIAL_PROJECT: ProjectSettingsDto = {
  id: '1',
  name: 'Marketing Campaign Q4',
  description: 'Coordinates content, design and launch tasks for the Q4 campaign.',
  status: 'DRAFT',
  ownerId: '1',
  myRole: 'OWNER',
  createdAt: '2026-09-01T08:00:00+07:00',
  updatedAt: '2026-10-02T14:30:00+07:00',
}

const INITIAL_MEMBERS: ProjectMemberDetail[] = [
  {
    userId: '1',
    username: 'Alex Kim',
    email: 'alex.kim@acme.io',
    role: 'OWNER',
    joinedAt: '2026-09-02T10:00:00+07:00',
    activeNodeCount: 3,
    avatarClass: 'bg-emerald-500',
    initials: 'AK',
  },
  {
    userId: '2',
    username: 'Sarah Chen',
    email: 'sarah.chen@acme.io',
    role: 'COLLABORATOR',
    joinedAt: '2026-09-04T10:00:00+07:00',
    activeNodeCount: 5,
    avatarClass: 'bg-indigo-500',
    initials: 'SC',
  },
  {
    userId: '3',
    username: 'Marcus Liu',
    email: 'marcus.liu@acme.io',
    role: 'COLLABORATOR',
    joinedAt: '2026-09-09T10:00:00+07:00',
    activeNodeCount: 6,
    avatarClass: 'bg-rose-500',
    initials: 'ML',
  },
  {
    userId: '4',
    username: 'Jamie Doe',
    email: 'jamie.doe@acme.io',
    role: 'VIEWER',
    joinedAt: '2026-09-15T10:00:00+07:00',
    activeNodeCount: 0,
    avatarClass: 'bg-amber-500',
    initials: 'JD',
  },
]

const INITIAL_LOGS: AuditLogItem[] = [
  {
    id: 'log-5',
    timestamp: '2026-10-03T09:12:44+07:00',
    actor: { userId: '1', name: 'Alex Kim', role: 'OWNER' },
    action: 'ROLE_CHANGED',
    details: "Changed Jamie Doe's role from COLLABORATOR to VIEWER.",
    scope: 'Access',
  },
  {
    id: 'log-4',
    timestamp: '2026-09-29T16:40:05+07:00',
    actor: { userId: '1', name: 'Alex Kim', role: 'OWNER' },
    action: 'MEMBER_INVITED',
    details: 'Invited marcus.liu@acme.io as COLLABORATOR.',
    scope: 'Access',
  },
  {
    id: 'log-3',
    timestamp: '2026-09-24T08:30:00+07:00',
    actor: { userId: 'sys', name: 'SYSTEM', role: 'SYSTEM' },
    action: 'PROJECT_UPDATED',
    details: 'Refreshed cached AI analysis for the project.',
    scope: 'Governance',
  },
  {
    id: 'log-2',
    timestamp: '2026-09-12T11:05:31+07:00',
    actor: { userId: '1', name: 'Alex Kim', role: 'OWNER' },
    action: 'PROJECT_UPDATED',
    details: 'Updated project description.',
    scope: 'Governance',
  },
  {
    id: 'log-1',
    timestamp: '2026-09-02T10:00:12+07:00',
    actor: { userId: '1', name: 'Alex Kim', role: 'OWNER' },
    action: 'MEMBER_INVITED',
    details: 'Invited sarah.chen@acme.io as COLLABORATOR.',
    scope: 'Access',
  },
]

const SETTINGS_STORAGE_KEY = 'wpe_mock_project_settings'

function loadStoredSettings(): ProjectSettingsDto {
  if (typeof window === 'undefined') return structuredClone(INITIAL_PROJECT)
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return structuredClone(INITIAL_PROJECT)
}

function saveStoredSettings(project: ProjectSettingsDto) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(project))
  } catch {}
}

export class MockSettingsApi implements Pick<
  IWorkflowService,
  | 'getProjectSettings'
  | 'updateProjectSettings'
  | 'publishPipeline'
  | 'getProjectMembersDetailed'
  | 'inviteProjectMember'
  | 'changeMemberRole'
  | 'removeProjectMember'
  | 'getProjectAuditLogs'
> {
  private project: ProjectSettingsDto = loadStoredSettings()
  private members: ProjectMemberDetail[] = structuredClone(INITIAL_MEMBERS)
  private auditLogs: AuditLogItem[] = structuredClone(INITIAL_LOGS)
  private invitations: ProjectInvitationDto[] = [
    {
      id: 'inv-101',
      projectId: '1',
      projectName: 'Marketing Campaign Q4',
      inviterId: '1',
      inviterName: 'Alex Kim',
      inviteeId: 'user-invitee-1',
      inviteeEmail: 'sarah.chen@pipeline.engine',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      version: 0,
    },
  ]

  private recordLog(
    action: AuditLogAction,
    details: string,
    scope: AuditScope,
    actorName = 'Alex Kim',
    actorRole: ProjectRole = 'OWNER',
    actorId = '1',
  ) {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      actor: { userId: actorId, name: actorName, role: actorRole },
      action,
      details,
      scope,
    }
    this.auditLogs.unshift(newLog)
  }

  async getProjectSettings(_projectId: string): Promise<ProjectSettingsDto> {
    await mockDelay()
    return structuredClone(this.project)
  }

  async updateProjectSettings(_projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto> {
    await mockDelay(120)
    const changes: string[] = []
    if (this.project.name !== cmd.name) changes.push('name')
    if (this.project.description !== cmd.description) changes.push('description')

    this.project.name = cmd.name
    this.project.description = cmd.description
    this.project.updatedAt = new Date().toISOString()

    const details = changes.length > 0 ? `Updated project ${changes.join(' and ')}.` : 'Saved project settings.'
    this.recordLog('PROJECT_UPDATED', details, 'Governance')

    return structuredClone(this.project)
  }

  async publishPipeline(_projectId: string): Promise<PublishPipelineResult> {
    await mockDelay(200)
    if (MockConfig.simulateCycle) {
      return {
        success: false,
        cycleDetected: true,
        violatingNodeIds: ['WPE-009', 'WPE-014', 'WPE-009'],
      }
    }

    this.project.status = 'ACTIVE'
    this.project.updatedAt = new Date().toISOString()
    this.recordLog(
      'PIPELINE_PUBLISHED',
      'Published pipeline from DRAFT to ACTIVE (Kahn cycle check passed with 24 nodes).',
      'Lifecycle',
    )

    return {
      success: true,
      newStatus: 'ACTIVE',
    }
  }

  async getProjectMembersDetailed(_projectId: string): Promise<ProjectMemberDetail[]> {
    await mockDelay()
    const list = structuredClone(this.members)
    return list.map((m) => {
      const savedAvatar = getSavedAvatar(m.username || m.userId)
      return {
        ...m,
        avatarUrl: m.avatarUrl || savedAvatar,
      }
    })
  }

  async inviteProjectMember(_projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail> {
    await mockDelay(150)
    const raw = cmd.usernameOrEmail.trim()
    if (!raw) throw new Error('Username or email is required')

    const isEmail = raw.includes('@')
    const username = isEmail ? raw.split('@')[0] : raw
    const email = isEmail ? raw : `${raw.toLowerCase().replace(/\s+/g, '.')}@acme.io`
    const initials = username
      .split(' ')
      .map((s) => s[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'

    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-violet-500', 'bg-teal-500', 'bg-emerald-500', 'bg-rose-500']
    const avatarClass = colors[this.members.length % colors.length]

    const newMember: ProjectMemberDetail = {
      userId: `user-${Date.now()}`,
      username,
      email,
      role: cmd.role,
      joinedAt: new Date().toISOString(),
      activeNodeCount: 0,
      avatarClass,
      initials,
    }

    this.members.push(newMember)

    const newInvitation: ProjectInvitationDto = {
      id: `inv-${Date.now()}`,
      projectId: _projectId || '1',
      projectName: this.project.name,
      inviterId: '1',
      inviterName: 'Alex Kim',
      inviteeId: newMember.userId,
      inviteeEmail: email,
      role: cmd.role,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      version: 0,
    }
    this.invitations.unshift(newInvitation)

    this.recordLog('MEMBER_INVITED', `Invited ${email} as ${cmd.role}.`, 'Access')

    return structuredClone(newMember)
  }

  async createProjectInvitation(projectId: string, cmd: InviteMemberCommand): Promise<ProjectInvitationDto> {
    await mockDelay(150)
    const raw = cmd.usernameOrEmail.trim()
    if (!raw) throw new Error('Username or email is required')

    const isEmail = raw.includes('@')
    const username = isEmail ? raw.split('@')[0] : raw
    const email = isEmail ? raw : `${raw.toLowerCase().replace(/\s+/g, '.')}@acme.io`

    const newInvitation: ProjectInvitationDto = {
      id: `inv-${Date.now()}`,
      projectId: projectId || '1',
      projectName: this.project.name,
      inviterId: '1',
      inviterName: 'Alex Kim',
      inviteeId: `user-${Date.now()}`,
      inviteeEmail: email,
      role: cmd.role,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      version: 0,
    }
    this.invitations.unshift(newInvitation)
    this.recordLog('MEMBER_INVITED', `Invited ${email} as ${cmd.role}.`, 'Access')
    return structuredClone(newInvitation)
  }

  async getProjectPendingInvitations(projectId: string): Promise<ProjectInvitationDto[]> {
    await mockDelay(80)
    return structuredClone(this.invitations.filter((i) => i.projectId === projectId && i.status === 'PENDING'))
  }

  async getInvitation(invitationId: string): Promise<ProjectInvitationDto | null> {
    await mockDelay(60)
    const inv = this.invitations.find((i) => i.id === invitationId)
    return inv ? structuredClone(inv) : null
  }

  async acceptInvitation(invitationId: string): Promise<{ success: boolean; projectId?: string }> {
    await mockDelay(150)
    const inv = this.invitations.find((i) => i.id === invitationId)
    if (!inv) throw new Error('Invitation not found')
    if (inv.status !== 'PENDING') throw new Error(`Invitation is ${inv.status}`)

    inv.status = 'ACCEPTED'
    inv.respondedAt = new Date().toISOString()
    inv.version = (inv.version ?? 0) + 1

    const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-violet-500', 'bg-teal-500', 'bg-emerald-500', 'bg-rose-500']
    const avatarClass = colors[this.members.length % colors.length]
    const username = inv.inviteeEmail.split('@')[0]
    const initials = username.slice(0, 2).toUpperCase() || 'U'

    const newMember: ProjectMemberDetail = {
      userId: inv.inviteeId || `usr-${Date.now()}`,
      username,
      email: inv.inviteeEmail,
      role: inv.role,
      joinedAt: new Date().toISOString(),
      activeNodeCount: 0,
      avatarClass,
      initials,
    }
    this.members.push(newMember)
    this.recordLog('MEMBER_INVITED', `${username} accepted invitation and joined as ${inv.role}.`, 'Access')
    return { success: true, projectId: inv.projectId }
  }

  async rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
    await mockDelay(100)
    const inv = this.invitations.find((i) => i.id === invitationId)
    if (!inv) throw new Error('Invitation not found')
    inv.status = 'REJECTED'
    inv.respondedAt = new Date().toISOString()
    inv.version = (inv.version ?? 0) + 1
    return { success: true }
  }

  async revokeInvitation(_projectId: string, invitationId: string): Promise<boolean> {
    await mockDelay(100)
    const inv = this.invitations.find((i) => i.id === invitationId)
    if (!inv) throw new Error('Invitation not found')
    inv.status = 'REVOKED'
    inv.respondedAt = new Date().toISOString()
    inv.version = (inv.version ?? 0) + 1
    this.recordLog('MEMBER_REMOVED', `Revoked invitation for ${inv.inviteeEmail}.`, 'Access')
    return true
  }

  async changeMemberRole(_projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail> {
    await mockDelay(120)
    const member = this.members.find((m) => m.userId === userId)
    if (!member) throw new Error('Member not found')
    if (member.role === 'OWNER') throw new Error('Cannot change OWNER role')

    const prevRole = member.role
    member.role = cmd.role

    let unassignNote = ''
    if (cmd.role === 'VIEWER' && member.activeNodeCount > 0) {
      unassignNote = ` (Unassigned ${member.activeNodeCount} active tasks)`
      member.activeNodeCount = 0
    }

    this.recordLog('ROLE_CHANGED', `Changed ${member.username}'s role from ${prevRole} to ${cmd.role}${unassignNote}.`, 'Access')
    return structuredClone(member)
  }

  async removeProjectMember(_projectId: string, userId: string): Promise<{ unassignedTaskCount: number }> {
    await mockDelay(150)
    const member = this.members.find((m) => m.userId === userId)
    if (!member) throw new Error('Member not found')
    if (member.role === 'OWNER') throw new Error('Cannot remove OWNER')

    const unassignedCount = member.activeNodeCount
    this.members = this.members.filter((m) => m.userId !== userId)

    const unassignNote = unassignedCount > 0 ? ` (Unassigned ${unassignedCount} active tasks)` : ''
    this.recordLog('MEMBER_REMOVED', `Removed ${member.username} from workspace${unassignNote}.`, 'Access')

    return { unassignedTaskCount: unassignedCount }
  }

  async getProjectAuditLogs(_projectId: string): Promise<AuditLogItem[]> {
    await mockDelay()
    return structuredClone(this.auditLogs)
  }

  async archiveProject(_projectId: string): Promise<ProjectSettingsDto> {
    await mockDelay(150)
    this.project.status = 'ARCHIVED'
    this.project.updatedAt = new Date().toISOString()
    saveStoredSettings(this.project)
    this.recordLog(
      'PROJECT_UPDATED',
      'Archived project. All configurations and modifications are locked in read-only mode.',
      'Lifecycle',
    )
    return structuredClone(this.project)
  }

  async restoreProject(_projectId: string): Promise<ProjectSettingsDto> {
    await mockDelay(150)
    this.project.status = 'ACTIVE'
    this.project.updatedAt = new Date().toISOString()
    saveStoredSettings(this.project)
    this.recordLog(
      'PROJECT_UPDATED',
      'Restored project from ARCHIVED to ACTIVE.',
      'Lifecycle',
    )
    return structuredClone(this.project)
  }

  async deleteProject(_projectId: string): Promise<void> {
    await mockDelay(200)
    this.recordLog('PROJECT_UPDATED', 'Project deleted by Owner.', 'Lifecycle')
  }

  setProjectStatus(status: ProjectStatus): void {
    this.project.status = status
    this.project.updatedAt = new Date().toISOString()
    saveStoredSettings(this.project)
  }

  reset(): void {
    this.project = structuredClone(INITIAL_PROJECT)
    this.members = structuredClone(INITIAL_MEMBERS)
    this.auditLogs = structuredClone(INITIAL_LOGS)
    this.invitations = [
      {
        id: 'inv-101',
        projectId: '1',
        projectName: 'Marketing Campaign Q4',
        inviterId: '1',
        inviterName: 'Alex Kim',
        inviteeId: 'user-invitee-1',
        inviteeEmail: 'sarah.chen@pipeline.engine',
        role: 'COLLABORATOR',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        version: 0,
      },
    ]
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(SETTINGS_STORAGE_KEY)
      } catch {}
    }
  }
}
