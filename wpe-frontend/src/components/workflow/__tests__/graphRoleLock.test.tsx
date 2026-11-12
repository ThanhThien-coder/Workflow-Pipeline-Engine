// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MacroWorkflow } from '../MacroWorkflow'
import { MindmapTree } from '../../mindmap/MindmapTree'
import { createWorkflowStore, useWorkflowStore } from '../../../store/useWorkflowStore'
import type { IWorkflowService } from '../../../services/contracts/IWorkflowService'
import type { ProjectRole, ProjectSettingsDto } from '../../../types/settings.types'
import type { GraphNodeMap } from '../../../types/workflow.types'

/**
 * B5 — Canvas khóa theo vai trò. Từ B3 backend chỉ cho owner sửa đồ thị;
 * giao diện phải chặn trước để Collaborator/Viewer không bấm được rồi mới nhận 403.
 */

function settingsFor(myRole: ProjectRole, status: ProjectSettingsDto['status'] = 'DRAFT'): ProjectSettingsDto {
  return {
    id: '1', name: 'Core Banking Pipeline', description: '', status, ownerId: '2', myRole,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  }
}

const READ_ONLY_TITLE = 'Chỉ chủ dự án được sửa đồ thị'

describe('B5: store chặn ghi đồ thị khi không phải owner', () => {
  function fakeService() {
    return {
      getMacroPhases: vi.fn(async () => []),
      getPhaseEdges: vi.fn(async () => []),
      getPhaseGraph: vi.fn(async () => ({})),
      createPhase: vi.fn(async () => ({ id: '9', name: 'P', sub: '', status: 'TODO', pct: 0, accent: 'slate', x: 0, y: 0, w: 1, h: 1, parentPhaseIds: [] })),
      connectPhases: vi.fn(async () => {}),
      disconnectPhases: vi.fn(async () => {}),
      deletePhase: vi.fn(async () => {}),
      updatePhasePosition: vi.fn(async () => {}),
      addRootTask: vi.fn(async () => ({ id: '3', title: 'x', status: 'LOCKED' })),
      attachGhostNode: vi.fn(async () => ({})),
    }
  }

  function storeWith(role: ProjectRole | null, status: ProjectSettingsDto['status'] = 'DRAFT') {
    const service = fakeService()
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState((s) => ({
      currentProjectId: '1',
      settings: { ...s.settings, settings: role ? settingsFor(role, status) : null },
    }))
    return { store, service }
  }

  it('VIEWER: tạo, nối, gỡ, xóa phase, lưu vị trí, thêm node, nối node đều bị chặn và KHÔNG gọi API', async () => {
    const { store, service } = storeWith('VIEWER')
    const s = store.getState()
    const results = await Promise.allSettled([
      s.createPhase({ name: 'P', sub: 's' }),
      s.connectPhases('10', '20'),
      s.disconnectPhases('10', '20'),
      s.deletePhase('10'),
      s.updatePhasePosition('10', { x: 1, y: 2 }),
      s.addRootTask('10', 'Task'),
      s.attachGhostNode('20', { sourcePhaseId: '10', sourceTaskId: '1', targetTaskId: '2' }),
      s.connectNodes('10', '1', '2'),
    ])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(service.createPhase).not.toHaveBeenCalled()
    expect(service.connectPhases).not.toHaveBeenCalled()
    expect(service.disconnectPhases).not.toHaveBeenCalled()
    expect(service.deletePhase).not.toHaveBeenCalled()
    expect(service.updatePhasePosition).not.toHaveBeenCalled()
    expect(service.addRootTask).not.toHaveBeenCalled()
    expect(service.attachGhostNode).not.toHaveBeenCalled()
  })

  it('COLLABORATOR (sarah) cũng chỉ xem', async () => {
    const { store, service } = storeWith('COLLABORATOR')
    await expect(store.getState().createPhase({ name: 'P', sub: 's' })).rejects.toMatchObject({ code: 'GRAPH_READ_ONLY' })
    expect(service.createPhase).not.toHaveBeenCalled()
  })

  it('OWNER (alex) gọi API bình thường', async () => {
    const { store, service } = storeWith('OWNER')
    await store.getState().createPhase({ name: 'P', sub: 's' })
    await store.getState().updatePhasePosition('9', { x: 5, y: 6 })
    expect(service.createPhase).toHaveBeenCalledTimes(1)
    expect(service.updatePhasePosition).toHaveBeenCalledWith('9', { x: 5, y: 6 }, '1')
  })

  it('dự án ARCHIVED: owner cũng chỉ xem', async () => {
    const { store, service } = storeWith('OWNER', 'ARCHIVED')
    await expect(store.getState().connectPhases('10', '20')).rejects.toMatchObject({ code: 'GRAPH_READ_ONLY' })
    expect(service.connectPhases).not.toHaveBeenCalled()
  })

  it('chưa nạp vai trò (vào thẳng canvas, settings null) thì không khóa: backend vẫn chặn bằng 403', async () => {
    const { store, service } = storeWith(null)
    await store.getState().createPhase({ name: 'P', sub: 's' })
    expect(service.createPhase).toHaveBeenCalledTimes(1)
  })
})

describe('B5: component canvas khóa theo vai trò', () => {
  beforeEach(() => {
    useWorkflowStore.setState((s) => ({ settings: { ...s.settings, settings: null } }))
  })
  afterEach(() => {
    cleanup()
    useWorkflowStore.setState((s) => ({ settings: { ...s.settings, settings: null } }))
  })

  function setRole(role: ProjectRole, status: ProjectSettingsDto['status'] = 'DRAFT') {
    useWorkflowStore.setState((s) => ({ settings: { ...s.settings, settings: settingsFor(role, status) } }))
  }

  it('VIEWER: nút Add Phase và Auto Layout bị vô hiệu hóa, có title giải thích', async () => {
    setRole('VIEWER')
    render(<MacroWorkflow projectId="1" />)

    const addPhase = screen.getByRole('button', { name: /add phase/i })
    expect((addPhase as HTMLButtonElement).disabled).toBe(true)
    expect((addPhase).getAttribute("title")).toBe(READ_ONLY_TITLE)
    expect((screen.getByRole('button', { name: /auto layout/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('VIEWER: thẻ phase không có nút xóa, cổng nối bị vô hiệu hóa', async () => {
    setRole('VIEWER')
    render(<MacroWorkflow projectId="1" />)

    await waitFor(() => expect(document.querySelectorAll('[data-phase-id][role="button"]').length).toBeGreaterThan(0))
    expect(screen.queryAllByTitle('Delete this phase')).toHaveLength(0)
    const ports = screen.getAllByTitle(READ_ONLY_TITLE).filter((el) => el.tagName === 'BUTTON' && el.className.includes('cursor'))
    expect(ports.length).toBeGreaterThan(0)
    ports.forEach((port) => expect((port as HTMLButtonElement).disabled).toBe(true))
  })

  it('OWNER: nút Add Phase và Auto Layout bấm được', () => {
    setRole('OWNER')
    render(<MacroWorkflow projectId="1" />)

    expect((screen.getByRole('button', { name: /add phase/i }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: /auto layout/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  const TREE: GraphNodeMap = {
    root_10: { id: 'root_10', kind: 'root', title: 'PHASE 1', parentIds: [] },
    '1': {
      id: '1', kind: 'branch', code: 'WPE-001', title: 'Thu thập yêu cầu', description: '', isTrack: false,
      status: 'TODO', assignee: '3', due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', phaseId: '10', parentIds: ['root_10'],
    },
  }

  it('VIEWER: trong cây node, nút + Add Root Task và Add Ghost Node bị vô hiệu hóa, node không có nút xóa', () => {
    setRole('VIEWER')
    render(<MindmapTree nodes={TREE} selectedId={null} onSelect={() => {}} onUpdateNodes={() => {}} phaseId="10" readOnly />)

    expect((screen.getByRole('button', { name: /add root task/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /add ghost node/i }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /add root task/i })).getAttribute("title")).toBe(READ_ONLY_TITLE)
    expect(screen.queryAllByTitle('Delete')).toHaveLength(0)
  })

  it('OWNER: trong cây node, nút + Add Root Task và Add Ghost Node bấm được', () => {
    setRole('OWNER')
    render(<MindmapTree nodes={TREE} selectedId={null} onSelect={() => {}} onUpdateNodes={() => {}} phaseId="10" />)

    expect((screen.getByRole('button', { name: /add root task/i }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: /add ghost node/i }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getAllByTitle('Delete').length).toBeGreaterThan(0)
  })
})
