import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import { MockConfig } from '../../../services/mock/MockConfig'
import { workflowService } from '../../../services/container'
import { ApiError } from '../../../services/http/ApiError'

describe('Project Settings & Governance Module', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    store = createWorkflowStore(new MockWorkflowService())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads project settings, members, and initial audit logs', async () => {
    await store.getState().settings.loadSettings('1')
    const state = store.getState().settings

    expect(state.status).toBe('ready')
    expect(state.settings).not.toBeNull()
    expect(state.settings?.name).toBe('Marketing Campaign Q4')
    expect(state.settings?.status).toBe('DRAFT')
    expect(state.members.length).toBe(4)
    expect(state.auditLogs.length).toBeGreaterThanOrEqual(5)
  })

  it('switches simulated role on the fly (RBAC)', async () => {
    await store.getState().settings.loadSettings('1')

    store.getState().settings.setSimulatedRole('COLLABORATOR')
    expect(store.getState().settings.simulatedRole).toBe('COLLABORATOR')
    expect(store.getState().settings.settings?.myRole).toBe('COLLABORATOR')

    store.getState().settings.setSimulatedRole('VIEWER')
    expect(store.getState().settings.simulatedRole).toBe('VIEWER')

    store.getState().settings.setSimulatedRole('OWNER')
    expect(store.getState().settings.simulatedRole).toBe('OWNER')
  })

  it('updates project settings and creates a PROJECT_UPDATED audit log', async () => {
    await store.getState().settings.loadSettings('1')
    const initialLogsCount = store.getState().settings.auditLogs.length

    const ok = await store.getState().settings.updateGeneralSettings({
      name: 'Marketing Campaign 2026 Q4 (Renamed)',
      description: 'New description for the pipeline.',
    })

    expect(ok).toBe(true)
    const state = store.getState().settings
    expect(state.settings?.name).toBe('Marketing Campaign 2026 Q4 (Renamed)')
    expect(state.settings?.description).toBe('New description for the pipeline.')

    expect(state.auditLogs.length).toBe(initialLogsCount + 1)
    expect(state.auditLogs[0].action).toBe('PROJECT_UPDATED')
    expect(state.auditLogs[0].scope).toBe('Governance')
  })

  it('detects Kahn cycle and halts pipeline publish with error nodes without changing status', async () => {
    await store.getState().settings.loadSettings('1')

    MockConfig.simulateCycle = true
    try {
      const ok = await store.getState().settings.publishProject()
      expect(ok).toBe(false)

      const state = store.getState().settings
      expect(state.settings?.status).toBe('DRAFT')
      expect(state.kahnCycleErrors).toEqual(['WPE-009', 'WPE-014', 'WPE-009'])
    } finally {
      MockConfig.simulateCycle = false
    }
  })

  it('publishes pipeline to ACTIVE when no cycle is detected', async () => {
    await store.getState().settings.loadSettings('1')

    MockConfig.simulateCycle = false
    const ok = await store.getState().settings.publishProject()
    expect(ok).toBe(true)

    const state = store.getState().settings
    expect(state.settings?.status).toBe('ACTIVE')
    expect(state.auditLogs[0].action).toBe('PIPELINE_PUBLISHED')
    expect(state.auditLogs[0].scope).toBe('Lifecycle')
  })

  it('invites a new member and updates audit log', async () => {
    await store.getState().settings.loadSettings('1')
    const initialCount = store.getState().settings.members.length

    const ok = await store.getState().settings.inviteMember({
      usernameOrEmail: 'david.beck@acme.io',
      role: 'COLLABORATOR',
    })

    expect(ok).toBe(true)
    const state = store.getState().settings
    expect(state.members.length).toBe(initialCount)
    const pendingInv = state.pendingInvitations.find((i) => i.inviteeEmail === 'david.beck@acme.io')
    expect(pendingInv).toBeDefined()
    expect(pendingInv?.role).toBe('COLLABORATOR')
    expect(state.auditLogs[0].action).toBe('MEMBER_INVITED')
  })

  it('changes member role and kicks member with unassign tasks', async () => {
    await store.getState().settings.loadSettings('1')

    // Find Sarah Chen (activeNodeCount = 5)
    const sarah = store.getState().settings.members.find((m) => m.username === 'Sarah Chen')
    expect(sarah).toBeDefined()

    // Demote to VIEWER
    const roleOk = await store.getState().settings.changeRole(sarah!.userId, 'VIEWER')
    expect(roleOk).toBe(true)

    const updatedSarah = store.getState().settings.members.find((m) => m.userId === sarah!.userId)
    expect(updatedSarah?.role).toBe('VIEWER')
    expect(updatedSarah?.activeNodeCount).toBe(0) // unassigned

    // Transfer ownership to Marcus Liu
    const marcus = store.getState().settings.members.find((m) => m.username === 'Marcus Liu')
    expect(marcus).toBeDefined()
    const transferOk = await store.getState().settings.changeRole(marcus!.userId, 'OWNER')
    expect(transferOk).toBe(true)
    expect(store.getState().settings.settings?.ownerId).toBe(marcus!.userId)

    // Kick Jamie Doe
    const jamie = store.getState().settings.members.find((m) => m.username === 'Jamie Doe')
    expect(jamie).toBeDefined()

    const kickOk = await store.getState().settings.kickMember(jamie!.userId)
    expect(kickOk).toBe(true)
    expect(store.getState().settings.members.find((m) => m.userId === jamie!.userId)).toBeUndefined()
    expect(store.getState().settings.auditLogs[0].action).toBe('MEMBER_REMOVED')
  })

  it('archives, restores, and deletes project with proper status and audit logging', async () => {
    await store.getState().workspace.loadProjects()
    await store.getState().settings.loadSettings('1')

    // 1. Archive project
    const archiveOk = await store.getState().settings.archiveProject()
    expect(archiveOk).toBe(true)
    expect(store.getState().settings.settings?.status).toBe('ARCHIVED')
    const archivedInWorkspace = store.getState().workspace.projects.find((p) => String(p.id) === '1')
    expect(archivedInWorkspace?.status).toBe('ARCHIVED')

    // 2. Restore project
    const restoreOk = await store.getState().settings.restoreProject()
    expect(restoreOk).toBe(true)
    expect(store.getState().settings.settings?.status).toBe('ACTIVE')
    const restoredInWorkspace = store.getState().workspace.projects.find((p) => String(p.id) === '1')
    expect(restoredInWorkspace?.status).toBe('ACTIVE')

    // 3. Open and close delete modal
    store.getState().settings.openDeleteModal()
    expect(store.getState().settings.isDeleteModalOpen).toBe(true)
    store.getState().settings.closeDeleteModal()
    expect(store.getState().settings.isDeleteModalOpen).toBe(false)

    // 4. Delete project
    const deleteOk = await store.getState().settings.deleteProject()
    expect(deleteOk).toBe(true)
    expect(store.getState().settings.isDeleteModalOpen).toBe(false)
    const deletedInWorkspace = store.getState().workspace.projects.find((p) => String(p.id) === '1')
    expect(deletedInWorkspace).toBeUndefined()
  })

  it('handles asynchronous invitation lifecycle: pending, revoke, accept', async () => {
    await store.getState().settings.loadSettings('1')
    const initialInvCount = store.getState().settings.pendingInvitations.length

    // 1. Inviting a member creates a pending invitation
    await store.getState().settings.inviteMember({
      usernameOrEmail: 'invitee.test@pipeline.org',
      role: 'VIEWER',
    })

    const pending = store.getState().settings.pendingInvitations
    expect(pending.length).toBe(initialInvCount + 1)
    const addedInv = pending.find((i) => i.inviteeEmail === 'invitee.test@pipeline.org')
    expect(addedInv).toBeDefined()
    expect(addedInv?.role).toBe('VIEWER')
    expect(addedInv?.status).toBe('PENDING')

    // 2. Revoking an invitation
    const revokeOk = await store.getState().settings.revokeInvitation(addedInv!.id)
    expect(revokeOk).toBe(true)
    expect(store.getState().settings.pendingInvitations.find((i) => i.id === addedInv!.id)).toBeUndefined()

    // 3. Accepting an existing seeded invitation (inv-101)
    const acceptOk = await store.getState().settings.acceptInvitation('inv-101')
    expect(acceptOk).toBe(true)
    expect(store.getState().settings.pendingInvitations.find((i) => i.id === 'inv-101')).toBeUndefined()
  })

  it('FC4: restoreProject dùng đúng status backend trả về (DRAFT cho dự án chưa xuất bản)', async () => {
    vi.spyOn(workflowService, 'getMyProjects').mockResolvedValue([
      {
        id: '1',
        name: 'Marketing Campaign Q4',
        description: '',
        status: 'ARCHIVED',
        ownerId: '1',
        ownerName: 'Alex Kim',
        role: 'OWNER',
        nodeCount: 0,
        totalNodes: 0,
        completedNodes: 0,
        inProgressNodes: 0,
        criticalPathLength: 0,
        completionPercent: 0,
        progressPercentage: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [],
      },
    ])
    await store.getState().workspace.loadProjects()
    await store.getState().settings.loadSettings('1')

    vi.spyOn(workflowService, 'restoreProject').mockResolvedValue({
      id: '1',
      name: 'Marketing Campaign Q4',
      description: '',
      status: 'DRAFT',
      ownerId: '1',
      myRole: 'OWNER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const ok = await store.getState().settings.restoreProject()

    expect(ok).toBe(true)
    expect(store.getState().settings.settings?.status).toBe('DRAFT')
    const restoredInWorkspace = store.getState().workspace.projects.find((p) => String(p.id) === '1')
    expect(restoredInWorkspace?.status).toBe('DRAFT')
    expect(store.getState().settings.toast).toContain('DRAFT')
  })

  it('FC4: deleteProject gọi service, xóa dự án khỏi danh sách workspace và toast "Đã xóa dự án"', async () => {
    vi.spyOn(workflowService, 'getMyProjects').mockResolvedValue([
      {
        id: '1',
        name: 'Marketing Campaign Q4',
        description: '',
        status: 'DRAFT',
        ownerId: '1',
        ownerName: 'Alex Kim',
        role: 'OWNER',
        nodeCount: 0,
        totalNodes: 0,
        completedNodes: 0,
        inProgressNodes: 0,
        criticalPathLength: 0,
        completionPercent: 0,
        progressPercentage: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [],
      },
    ])
    await store.getState().workspace.loadProjects()
    await store.getState().settings.loadSettings('1')
    const deleteSpy = vi.spyOn(workflowService, 'deleteProject').mockResolvedValue(undefined)

    store.getState().settings.openDeleteModal()
    const ok = await store.getState().settings.deleteProject()

    expect(deleteSpy).toHaveBeenCalledWith('1')
    expect(ok).toBe(true)
    expect(store.getState().settings.isDeleteModalOpen).toBe(false)
    expect(store.getState().workspace.projects.find((p) => String(p.id) === '1')).toBeUndefined()
    expect(store.getState().settings.toast).toBe('Đã xóa dự án')
    expect(store.getState().ui.toast?.message).toBe('Đã xóa dự án')
  })

  it('FC4: deleteProject khi lỗi thì ném lỗi, giữ message backend và không xóa dự án khỏi danh sách', async () => {
    vi.spyOn(workflowService, 'getMyProjects').mockResolvedValue([
      {
        id: '1',
        name: 'Marketing Campaign Q4',
        description: '',
        status: 'DRAFT',
        ownerId: '1',
        ownerName: 'Alex Kim',
        role: 'OWNER',
        nodeCount: 0,
        totalNodes: 0,
        completedNodes: 0,
        inProgressNodes: 0,
        criticalPathLength: 0,
        completionPercent: 0,
        progressPercentage: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [],
      },
    ])
    await store.getState().workspace.loadProjects()
    await store.getState().settings.loadSettings('1')
    const backendError = new ApiError({
      status: 403,
      code: 'ACCESS_DENIED',
      message: 'Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.',
    })
    vi.spyOn(workflowService, 'deleteProject').mockRejectedValue(backendError)

    store.getState().settings.openDeleteModal()

    await expect(store.getState().settings.deleteProject()).rejects.toThrow(
      'Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.',
    )

    expect(store.getState().settings.error).toBe(
      'Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.',
    )
    expect(store.getState().settings.isDeleteModalOpen).toBe(true)
    expect(store.getState().workspace.projects.find((p) => String(p.id) === '1')).toBeDefined()
  })
})
