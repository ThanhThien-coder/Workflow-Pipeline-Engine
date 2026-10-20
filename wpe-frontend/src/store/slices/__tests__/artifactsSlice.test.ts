// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'

describe('Artifacts & Deliverables Module (artifactsSlice)', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    localStorage.clear()
    store = createWorkflowStore(new MockWorkflowService())
  })

  it('loads default initial artifacts when storage is empty', () => {
    store.getState().artifacts.loadArtifacts('1')
    const items = store.getState().artifacts.items

    expect(items.length).toBeGreaterThanOrEqual(5)
    expect(items.some((i) => i.title === 'Figma Design System')).toBe(true)
    expect(items.some((i) => i.title === 'API Documentation')).toBe(true)
  })

  it('controls drawer open, close, and toggle states', () => {
    expect(store.getState().artifacts.isDrawerOpen).toBe(false)

    store.getState().artifacts.openDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(true)

    store.getState().artifacts.closeDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(false)

    store.getState().artifacts.toggleDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(true)

    store.getState().artifacts.toggleDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(false)
  })

  it('adds a new artifact and creates RESOURCE_ADDED audit log', async () => {
    // initialize settings for audit log
    await store.getState().settings.loadSettings('1')
    const initialLogsCount = store.getState().settings.auditLogs.length

    const created = store.getState().artifacts.addArtifact(
      {
        title: 'PR #42 Backend Engine',
        url: 'https://github.com/wpe/engine/pull/42',
        createdBy: 'Alex Kim',
      },
      '1',
    )

    expect(created.id).toBeDefined()
    expect(created.title).toBe('PR #42 Backend Engine')
    expect(created.url).toBe('https://github.com/wpe/engine/pull/42')

    const items = store.getState().artifacts.items
    expect(items[0].title).toBe('PR #42 Backend Engine')

    // Verify Audit Log was generated
    const auditLogs = store.getState().settings.auditLogs
    expect(auditLogs.length).toBe(initialLogsCount + 1)
    expect(auditLogs[0].action).toBe('RESOURCE_ADDED')
    expect(auditLogs[0].details).toContain('PR #42 Backend Engine')
  })

  it('removes an artifact and creates RESOURCE_REMOVED audit log', async () => {
    await store.getState().settings.loadSettings('1')
    store.getState().artifacts.loadArtifacts('1')

    const initialItems = store.getState().artifacts.items
    const targetToRemove = initialItems[0]
    const initialLogsCount = store.getState().settings.auditLogs.length

    store.getState().artifacts.removeArtifact(targetToRemove.id, '1')

    const afterItems = store.getState().artifacts.items
    expect(afterItems.find((i) => i.id === targetToRemove.id)).toBeUndefined()
    expect(afterItems.length).toBe(initialItems.length - 1)

    // Verify Audit Log was generated
    const auditLogs = store.getState().settings.auditLogs
    expect(auditLogs.length).toBe(initialLogsCount + 1)
    expect(auditLogs[0].action).toBe('RESOURCE_REMOVED')
    expect(auditLogs[0].details).toContain(targetToRemove.title)
  })

  it('persists artifacts in localStorage per projectId', () => {
    store.getState().artifacts.addArtifact(
      {
        title: 'Project 2 Custom Spec',
        url: 'https://notion.so/spec/p2',
        createdBy: 'Sarah',
      },
      'proj-2',
    )

    const raw = localStorage.getItem('wpe_artifacts_proj-2')
    expect(raw).not.toBeNull()
    expect(raw).toContain('Project 2 Custom Spec')
  })
})
