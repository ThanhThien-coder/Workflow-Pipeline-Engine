import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import { MockConfig } from '../../../services/mock/MockConfig'

describe('Project Settings & Governance Module', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    store = createWorkflowStore(new MockWorkflowService())
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
    expect(state.members.length).toBe(initialCount + 1)
    const newMember = state.members.find((m) => m.email === 'david.beck@acme.io')
    expect(newMember).toBeDefined()
    expect(newMember?.role).toBe('COLLABORATOR')
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
})
