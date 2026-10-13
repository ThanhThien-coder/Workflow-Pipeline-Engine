import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import { MockConfig } from '../../../services/mock/MockConfig'

describe('Dev & Scenario Simulation Module (devSlice)', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    MockConfig.latencyMs = 0
    MockConfig.fakeError500 = false
    store = createWorkflowStore(new MockWorkflowService())
  })

  it('switches persona across all slices simultaneously (RBAC, Kanban, Overview)', async () => {
    await store.getState().settings.loadSettings('1')
    await store.getState().overview.load('1')

    // Switch to Sarah Chen (COLLABORATOR - id: 2)
    await store.getState().dev.switchDevPersona('2')
    expect(store.getState().dev.currentPersonaId).toBe('2')
    expect(store.getState().kanban.currentUserId).toBe('2')
    expect(store.getState().settings.simulatedRole).toBe('COLLABORATOR')
    expect(store.getState().settings.settings?.myRole).toBe('COLLABORATOR')
    expect(store.getState().overview.data?.project.role).toBe('COLLABORATOR')

    // Switch to Jamie Doe (VIEWER - id: 4)
    await store.getState().dev.switchDevPersona('4')
    expect(store.getState().dev.currentPersonaId).toBe('4')
    expect(store.getState().kanban.currentUserId).toBe('4')
    expect(store.getState().settings.simulatedRole).toBe('VIEWER')
    expect(store.getState().settings.settings?.myRole).toBe('VIEWER')

    // Switch back to Alex Kim (OWNER - id: 1)
    await store.getState().dev.switchDevPersona('1')
    expect(store.getState().dev.currentPersonaId).toBe('1')
    expect(store.getState().kanban.currentUserId).toBe('1')
    expect(store.getState().settings.simulatedRole).toBe('OWNER')
    expect(store.getState().settings.settings?.myRole).toBe('OWNER')
  })

  it('updates project lifecycle status across settings, overview, and mock service memory', async () => {
    await store.getState().settings.loadSettings('1')
    await store.getState().overview.load('1')

    // Change to ACTIVE
    await store.getState().dev.setDevProjectStatus('ACTIVE')
    expect(store.getState().settings.settings?.status).toBe('ACTIVE')
    expect(store.getState().overview.data?.project.phaseLabel).toBe('Phase 2 · Published')

    // Change to ARCHIVED
    await store.getState().dev.setDevProjectStatus('ARCHIVED')
    expect(store.getState().settings.settings?.status).toBe('ARCHIVED')
    expect(store.getState().overview.data?.project.phaseLabel).toBe('Phase 2 · Archived')
  })

  it('controls Kahn cycle simulation flag and triggers HTTP 400 error on publish', async () => {
    await store.getState().settings.loadSettings('1')

    // Normal publish without cycle simulation
    store.getState().dev.setDevSimulateCycle(false)
    const normalOk = await store.getState().settings.publishProject()
    expect(normalOk).toBe(true)

    // Reset status to DRAFT
    await store.getState().dev.setDevProjectStatus('DRAFT')

    // Enable cycle simulation in DevToolbar
    store.getState().dev.setDevSimulateCycle(true)
    expect(store.getState().dev.simulateCycle).toBe(true)

    const cycleOk = await store.getState().settings.publishProject()
    expect(cycleOk).toBe(false)
    expect(store.getState().settings.kahnCycleErrors).toEqual(['WPE-009', 'WPE-014', 'WPE-009'])
    expect(store.getState().settings.settings?.status).toBe('DRAFT')
  })

  it('configures network latency and fake HTTP 500 error in MockConfig', () => {
    store.getState().dev.setDevLatency(500)
    expect(store.getState().dev.latencyMs).toBe(500)
    expect(MockConfig.latencyMs).toBe(500)

    store.getState().dev.setDevFakeError(true)
    expect(store.getState().dev.isFakeError500).toBe(true)
    expect(MockConfig.fakeError500).toBe(true)
  })

  it('resets all mock data back to initial SEED and reloads slices', async () => {
    await store.getState().settings.loadSettings('1')
    await store.getState().dev.setDevProjectStatus('ARCHIVED')
    expect(store.getState().settings.settings?.status).toBe('ARCHIVED')

    // Trigger reset
    await store.getState().dev.resetDevMockData()
    expect(store.getState().settings.settings?.status).toBe('DRAFT')
    expect(store.getState().dev.simulateCycle).toBe(false)
    expect(store.getState().dev.isFakeError500).toBe(false)
  })
})
