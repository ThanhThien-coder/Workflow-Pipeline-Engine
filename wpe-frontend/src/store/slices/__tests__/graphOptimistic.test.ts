import { describe, it, expect, vi } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import type { IWorkflowService, TaskNodePatch } from '../../../services/contracts/IWorkflowService'
import type { BranchGraphNode, GraphNodeMap, MacroPhase } from '../../../types/workflow.types'
import type { ProjectSettingsDto } from '../../../types/settings.types'
import { ApiError } from '../../../services/http/ApiError'

/** S03 — cập nhật lạc quan: thẻ hiện ngay khi API ghi trả về, đọc lại cây chạy nền, lỗi thì hoàn lại. */

const ROOT = 'root_20'

function branch(id: string, over: Partial<BranchGraphNode> = {}): BranchGraphNode {
  return {
    id,
    kind: 'branch',
    code: `WPE-${id}`,
    title: `Task ${id}`,
    description: '',
    isTrack: false,
    status: 'TODO',
    assignee: null,
    due: null,
    blocker: null,
    joinPolicy: 'ALL_COMPLETED',
    parentIds: [ROOT],
    ...over,
  }
}

function baseTree(): GraphNodeMap {
  return {
    [ROOT]: { id: ROOT, kind: 'root', title: 'P', parentIds: [] },
    '2': branch('2'),
    '3': branch('3', { parentIds: ['2'] }),
  }
}

const phase = { id: '20', name: 'P', parentPhaseIds: [], pct: 0, status: 'TODO' } as unknown as MacroPhase
const info: ProjectSettingsDto = { id: '7', name: 'P', description: '', status: 'DRAFT', ownerId: '2', myRole: 'OWNER', createdAt: '', updatedAt: '' }
const PATCH: TaskNodePatch = { title: '  Mới ', description: 'd', joinPolicy: 'ANY_COMPLETED', assigneeId: '5', dueDate: '2026-12-01' }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const graphGate = deferred<GraphNodeMap>()
  const service = {
    getMacroPhases: vi.fn(async () => []),
    getPhaseEdges: vi.fn(async () => []),
    getPhaseGraph: vi.fn(() => graphGate.promise),
    addRootTask: vi.fn(),
    addChildTask: vi.fn(),
    attachGhostNode: vi.fn(async () => ({})),
    deleteDependency: vi.fn(async () => {}),
    updateTaskNode: vi.fn(async () => {}),
    deleteTaskNode: vi.fn(async () => {}),
  }
  const store = createWorkflowStore(service as unknown as IWorkflowService)
  store.setState((s) => ({
    currentProjectId: '7',
    project: { ...s.project, projectId: '7', info },
    macroPhases: [phase],
    trees: { '20': baseTree() },
  }))
  return { store, service, graphGate }
}

describe('store: cập nhật lạc quan (S03)', () => {
  it('addRootTask: thẻ hiện ngay khi POST trả về, trước khi GET đồ thị trả về', async () => {
    const { store, service, graphGate } = setup()
    service.addRootTask.mockResolvedValue({ id: '9', title: 'Mới', status: 'LOCKED', node: branch('9', { title: 'Mới', status: 'LOCKED' }) })

    await store.getState().addRootTask('20', 'Mới') // resolve dù GET đồ thị chưa trả về

    const tree = store.getState().trees['20']
    expect(tree['9']).toMatchObject({ title: 'Mới', parentIds: [ROOT] })
    expect(service.getPhaseGraph).toHaveBeenCalledTimes(1)
    graphGate.resolve(baseTree())
  })

  it('addRootTask: POST lỗi thì không có thẻ và không đọc lại cây', async () => {
    const { store, service } = setup()
    service.addRootTask.mockRejectedValue(new ApiError({ status: 500, code: 'X', message: 'lỗi' }))

    await expect(store.getState().addRootTask('20', 'Mới')).rejects.toMatchObject({ status: 500 })

    expect(Object.keys(store.getState().trees['20'])).toEqual(Object.keys(baseTree()))
    expect(service.getPhaseGraph).not.toHaveBeenCalled()
  })

  it('addChildTask: thẻ con treo dưới cha, tiến độ phase tính lại', async () => {
    const { store, service } = setup()
    service.addChildTask.mockResolvedValue({ id: '9', title: 'C', status: 'LOCKED', node: branch('9', { status: 'LOCKED' }) })

    await store.getState().addChildTask('20', ['2', '3'], 'C')

    expect(store.getState().trees['20']['9'].parentIds).toEqual(['2', '3'])
  })

  it('addChildTask: dự án đã publish (POST trả TODO) mà cha chưa Done -> thẻ con hiện Locked ngay', async () => {
    const { store, service } = setup()
    service.addChildTask.mockResolvedValue({ id: '9', title: 'C', status: 'TODO', node: branch('9', { status: 'TODO' }) })

    await store.getState().addChildTask('20', ['2'], 'C')

    expect((store.getState().trees['20']['9'] as BranchGraphNode).status).toBe('LOCKED')
  })

  it('addChildTask: mọi cha đã Done -> giữ trạng thái POST trả (TODO)', async () => {
    const { store, service } = setup()
    store.setState((s) => ({ trees: { '20': { ...s.trees['20'], '2': branch('2', { status: 'DONE' }) } } }))
    service.addChildTask.mockResolvedValue({ id: '9', title: 'C', status: 'TODO', node: branch('9', { status: 'TODO' }) })

    await store.getState().addChildTask('20', ['2'], 'C')

    expect((store.getState().trees['20']['9'] as BranchGraphNode).status).toBe('TODO')
  })

  it('tạo 5 task liên tiếp: lần đọc cũ (thiếu thẻ) về muộn bị bỏ, đủ 5 thẻ', async () => {
    const { store, service } = setup()
    const gates: Array<ReturnType<typeof deferred<GraphNodeMap>>> = []
    service.getPhaseGraph.mockImplementation(() => {
      const gate = deferred<GraphNodeMap>()
      gates.push(gate)
      return gate.promise
    })
    for (let i = 10; i < 15; i += 1) {
      service.addRootTask.mockResolvedValueOnce({ id: String(i), title: `T${i}`, status: 'LOCKED', node: branch(String(i), { title: `T${i}` }) })
      await store.getState().addRootTask('20', `T${i}`)
    }
    expect(gates).toHaveLength(5)
    // Bốn lần đọc đầu (đã cũ, thiếu thẻ) về muộn: phải bị bỏ
    for (let i = 0; i < 4; i += 1) gates[i].resolve(baseTree())
    await new Promise((r) => setTimeout(r, 0))
    let ids = Object.keys(store.getState().trees['20'])
    for (let i = 10; i < 15; i += 1) expect(ids).toContain(String(i))
    // Lần đọc cuối (có đủ 5 thẻ) về: áp dụng
    const full = baseTree()
    for (let i = 10; i < 15; i += 1) full[String(i)] = branch(String(i), { code: `WPE-${i}` })
    gates[4].resolve(full)
    await new Promise((r) => setTimeout(r, 0))
    ids = Object.keys(store.getState().trees['20'])
    for (let i = 10; i < 15; i += 1) expect(ids.filter((id) => id === String(i))).toHaveLength(1)
  })

  it('updateNodeInfo: tiêu đề đổi ngay; API lỗi thì trả về bản cũ và ném lỗi', async () => {
    const { store, service } = setup()
    let seenDuring = ''
    service.updateTaskNode.mockImplementationOnce(async () => {
      seenDuring = store.getState().trees['20']['2'].title
      throw new ApiError({ status: 409, code: 'CONFLICT', message: 'x' })
    })

    await expect(store.getState().updateNodeInfo('20', '2', PATCH)).rejects.toMatchObject({ status: 409 })

    expect(seenDuring).toBe('Mới')
    expect(store.getState().trees['20']['2']).toMatchObject({ title: 'Task 2', assignee: null })
  })

  it('removeNode: thẻ biến mất ngay, con về dưới root; API lỗi thì hoàn lại cả hai', async () => {
    const { store, service } = setup()
    let during: GraphNodeMap = {}
    service.deleteTaskNode.mockImplementationOnce(async () => {
      during = store.getState().trees['20']
      throw new ApiError({ status: 409, code: 'X', message: 'x' })
    })

    await expect(store.getState().removeNode('20', '2')).rejects.toBeTruthy()

    expect(during['2']).toBeUndefined()
    expect(during['3'].parentIds).toEqual([ROOT])
    const after = store.getState().trees['20']
    expect(after['2']).toBeDefined()
    expect(after['3'].parentIds).toEqual(['2'])
  })

  it('connectNodes: vẽ cạnh ngay; 422 tạo vòng thì gỡ cạnh', async () => {
    const { store, service } = setup()
    store.setState({ trees: { '20': { ...baseTree(), '4': branch('4') } } })
    let during: string[] = []
    service.attachGhostNode.mockImplementationOnce(async () => {
      during = store.getState().trees['20']['4'].parentIds
      throw new ApiError({ status: 422, code: 'CYCLE', message: 'vòng' })
    })

    await expect(store.getState().connectNodes('20', '3', '4')).rejects.toMatchObject({ status: 422 })

    expect(during).toEqual(['3'])
    expect(store.getState().trees['20']['4'].parentIds).toEqual([ROOT])
  })

  it('removeDependency: gỡ cạnh ngay; lỗi thì dựng lại cạnh', async () => {
    const { store, service } = setup()
    service.deleteDependency.mockRejectedValueOnce(new ApiError({ status: 500, code: 'X', message: 'x' }))

    await expect(store.getState().removeDependency('20', '2', '3')).rejects.toBeTruthy()

    expect(store.getState().trees['20']['3'].parentIds).toEqual(['2'])
  })
})
