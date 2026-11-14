import { describe, it, expect, vi } from 'vitest'
import { createWorkflowStore, selectCanEditGraph } from '../../useWorkflowStore'
import type { IWorkflowService, TaskNodePatch } from '../../../services/contracts/IWorkflowService'
import type { ProjectRole, ProjectSettingsDto } from '../../../types/settings.types'
import { ApiError } from '../../../services/http/ApiError'

/** T3 (G7, G8, G11) — action ghi task của store: gọi API rồi đọc lại cây; không phải owner thì chặn. */

function info(myRole: ProjectRole): ProjectSettingsDto {
  return { id: '7', name: 'P', description: '', status: 'DRAFT', ownerId: '2', myRole, createdAt: '', updatedAt: '' }
}

function setup(role: ProjectRole = 'OWNER') {
  const service = {
    getMacroPhases: vi.fn(async () => []),
    getPhaseEdges: vi.fn(async () => []),
    getPhaseGraph: vi.fn(async () => ({ root_20: { id: 'root_20', kind: 'root', title: 'P', parentIds: [] } })),
    addRootTask: vi.fn(),
    attachGhostNode: vi.fn(),
    addChildTask: vi.fn(async () => ({ id: '9', title: 'Sub', status: 'LOCKED' })),
    updateTaskNode: vi.fn(async () => {}),
    deleteTaskNode: vi.fn(async () => {}),
  }
  const store = createWorkflowStore(service as unknown as IWorkflowService)
  store.setState((s) => ({ currentProjectId: '7', project: { ...s.project, projectId: '7', info: info(role) } }))
  return { store, service }
}

const PATCH: TaskNodePatch = { title: 'X', description: '', joinPolicy: 'ALL_COMPLETED', assigneeId: null, dueDate: null }

describe('store: ghi task qua API', () => {
  it('addChildTask gọi service rồi đọc lại cây của phase', async () => {
    const { store, service } = setup()

    await store.getState().addChildTask('20', ['2'], 'Sub')

    expect(service.addChildTask).toHaveBeenCalledWith('20', ['2'], { title: 'Sub' })
    expect(service.getPhaseGraph).toHaveBeenCalledWith('20', '7')
  })

  it('updateNodeInfo và removeNode gọi service rồi đọc lại cây', async () => {
    const { store, service } = setup()

    await store.getState().updateNodeInfo('20', '2', PATCH)
    await store.getState().removeNode('20', '2')

    expect(service.updateTaskNode).toHaveBeenCalledWith('2', PATCH)
    expect(service.deleteTaskNode).toHaveBeenCalledWith('2')
    expect(service.getPhaseGraph).toHaveBeenCalledTimes(2)
  })

  it('API lỗi thì ném lỗi, không đọc lại cây', async () => {
    const { store, service } = setup()
    service.updateTaskNode.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'Task đã bị sửa' }))

    await expect(store.getState().updateNodeInfo('20', '2', PATCH)).rejects.toMatchObject({ status: 409 })
    expect(service.getPhaseGraph).not.toHaveBeenCalled()
  })

  it('không phải owner (vai trò lấy từ dự án đang mở) thì chặn, không gọi API', async () => {
    const { store, service } = setup('COLLABORATOR')
    const s = store.getState()

    const results = await Promise.allSettled([
      s.addChildTask('20', ['2'], 'Sub'),
      s.updateNodeInfo('20', '2', PATCH),
      s.removeNode('20', '2'),
    ])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(service.addChildTask).not.toHaveBeenCalled()
    expect(service.updateTaskNode).not.toHaveBeenCalled()
    expect(service.deleteTaskNode).not.toHaveBeenCalled()
  })
})

describe('selectCanEditGraph lấy vai trò từ dự án đang mở', () => {
  it('chưa vào tab Settings nhưng đã tải dự án: thành viên không phải owner thì không được sửa', () => {
    const { store } = setup('COLLABORATOR')
    expect(store.getState().settings.settings).toBeNull()
    expect(selectCanEditGraph(store.getState())).toBe(false)
  })

  it('owner được sửa', () => {
    const { store } = setup('OWNER')
    expect(selectCanEditGraph(store.getState())).toBe(true)
  })

  it('thông tin dự án đã tải là của dự án khác thì không dùng', () => {
    const { store } = setup('COLLABORATOR')
    store.setState({ currentProjectId: '8' })
    expect(selectCanEditGraph(store.getState())).toBe(true)
  })
})

describe('store.forceUnlockNode (T6)', () => {
  it('owner: gọi service mở khóa sớm rồi đọc lại cây', async () => {
    const { store, service } = setup('OWNER')
    const forceUnlockTask = vi.fn(async () => {})
    Object.assign(service, { forceUnlockTask })

    await store.getState().forceUnlockNode('20', '2')

    expect(forceUnlockTask).toHaveBeenCalledWith('2')
    expect(service.getPhaseGraph).toHaveBeenCalledWith('20', '7')
  })

  it('không phải owner thì chặn, không gọi API', async () => {
    const { store, service } = setup('COLLABORATOR')
    const forceUnlockTask = vi.fn(async () => {})
    Object.assign(service, { forceUnlockTask })

    await expect(store.getState().forceUnlockNode('20', '2')).rejects.toMatchObject({ code: 'GRAPH_READ_ONLY' })
    expect(forceUnlockTask).not.toHaveBeenCalled()
  })
})
