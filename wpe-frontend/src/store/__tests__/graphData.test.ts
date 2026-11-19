import { describe, it, expect, vi } from 'vitest'
import { createWorkflowStore } from '../useWorkflowStore'
import type { IWorkflowService } from '../../services/contracts/IWorkflowService'
import type { MacroPhase, PhaseTreeData } from '../../types/workflow.types'

/** TASK_69 — dữ liệu đồ thị: tải 1 lần, chống lẫn dự án, đổi tên, tạo nhanh, gỡ dây. */

function phase(id: string, name = `P${id}`): MacroPhase {
  return { id, name, sub: '', status: 'TODO', pct: 0, accent: 'slate', w: 260, h: 128, parentPhaseIds: [] }
}
function tree(id: string): PhaseTreeData {
  return { [`root_${id}`]: { id: `root_${id}`, kind: 'root', title: id, parentIds: [] } }
}
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
type Graph = { phases: MacroPhase[]; edges: [string, string][]; trees: Record<string, PhaseTreeData> }
function graphOf(id: string): Graph {
  return { phases: [phase(id)], edges: [], trees: { [id]: tree(id) } }
}

describe('store.loadPhases', () => {
  it('dự án A chậm, B nhanh: state cuối là của B', async () => {
    const a = deferred<Graph>()
    const getProjectGraph = vi.fn((pid: string) => (pid === 'A' ? a.promise : Promise.resolve(graphOf('b1'))))
    const store = createWorkflowStore({ getProjectGraph } as unknown as IWorkflowService)

    const pa = store.getState().loadPhases('A')
    await store.getState().loadPhases('B')
    a.resolve(graphOf('a1'))
    await pa

    const s = store.getState()
    expect(s.currentProjectId).toBe('B')
    expect(s.macroPhases.map((p) => p.id)).toEqual(['b1'])
    expect(Object.keys(s.trees)).toEqual(['b1'])
    expect(s.graphStatus).toBe('ready')
  })

  it('có getProjectGraph thì gọi đúng 1 lần, không gọi getPhaseGraph', async () => {
    const service = {
      getProjectGraph: vi.fn(async () => graphOf('1')),
      getMacroPhases: vi.fn(),
      getPhaseEdges: vi.fn(),
      getPhaseGraph: vi.fn(),
    }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    await store.getState().loadPhases('7')
    expect(service.getProjectGraph).toHaveBeenCalledTimes(1)
    expect(service.getPhaseGraph).not.toHaveBeenCalled()
    expect(service.getMacroPhases).not.toHaveBeenCalled()
  })

  it('đổi dự án xóa dữ liệu cũ và selectedPhaseId; cùng dự án thì giữ dữ liệu', async () => {
    const pending = deferred<Graph>()
    const service = { getProjectGraph: vi.fn(() => pending.promise) }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState({ currentProjectId: 'A', macroPhases: [phase('x')], trees: { x: tree('x') }, selectedPhaseId: 'x' })

    const p = store.getState().loadPhases('A')
    expect(store.getState().macroPhases).toHaveLength(1)
    expect(store.getState().graphStatus).toBe('loading')
    pending.resolve(graphOf('x'))
    await p

    const p2 = store.getState().loadPhases('B')
    expect(store.getState().macroPhases).toEqual([])
    expect(store.getState().trees).toEqual({})
    expect(store.getState().selectedPhaseId).toBeNull()
    await p2
  })

  it('lỗi thì không ném, graphStatus = error kèm graphError', async () => {
    const service = { getProjectGraph: vi.fn(async () => { throw new Error('boom') }) }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    await expect(store.getState().loadPhases('7')).resolves.toBeUndefined()
    expect(store.getState().graphStatus).toBe('error')
    expect(store.getState().graphError).toBe('boom')
  })

  it('thiếu getProjectGraph thì dùng cách cũ', async () => {
    const service = {
      getMacroPhases: vi.fn(async () => [phase('1')]),
      getPhaseEdges: vi.fn(async () => []),
      getPhaseGraph: vi.fn(async () => tree('1')),
    }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    await store.getState().loadPhases('7')
    expect(service.getPhaseGraph).toHaveBeenCalledWith('1', '7')
    expect(store.getState().graphStatus).toBe('ready')
  })
})

describe('store: deletePhase, renamePhase, spawnChildPhase, removeDependency', () => {
  it('deletePhase xong thì tải lại đồ thị một lần', async () => {
    const service = { deletePhase: vi.fn(async () => {}), getProjectGraph: vi.fn(async () => graphOf('2')) }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState({ currentProjectId: '7', macroPhases: [phase('1'), phase('2')] })
    await store.getState().deletePhase('1')
    expect(service.getProjectGraph).toHaveBeenCalledTimes(1)
    expect(service.getProjectGraph).toHaveBeenCalledWith('7')
  })

  it('renamePhase trim, gọi service và đổi tên trong macroPhases; tên rỗng thì ném', async () => {
    const service = { renamePhase: vi.fn(async () => {}) }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState({ currentProjectId: '7', macroPhases: [phase('1', 'Old')] })
    await store.getState().renamePhase('1', '  New name ')
    expect(service.renamePhase).toHaveBeenCalledWith('1', 'New name', '7')
    expect(store.getState().macroPhases[0].name).toBe('New name')
    await expect(store.getState().renamePhase('1', '   ')).rejects.toThrow()
  })

  it('spawnChildPhase bấm 2 lần liền chỉ tạo 1 phase tên "New phase", đặt phaseToRename', async () => {
    const gate = deferred<MacroPhase>()
    const service = {
      createPhase: vi.fn((..._args: unknown[]) => gate.promise),
      getPhaseGraph: vi.fn(async () => tree('9')),
    }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState({ currentProjectId: '7', macroPhases: [phase('1')] })

    const first = store.getState().spawnChildPhase('1')
    const second = store.getState().spawnChildPhase('1')
    expect(store.getState().isSpawningPhase).toBe(true)
    gate.resolve(phase('9', 'New phase'))
    await Promise.all([first, second])

    expect(service.createPhase).toHaveBeenCalledTimes(1)
    expect(service.createPhase.mock.calls[0][0]).toMatchObject({ name: 'New phase', sub: '', parentPhaseId: '1' })
    expect(store.getState().phaseToRename).toBe('9')
    expect(store.getState().isSpawningPhase).toBe(false)
    store.getState().clearPhaseToRename()
    expect(store.getState().phaseToRename).toBeNull()
  })

  it('removeDependency gọi service rồi đọc lại cây', async () => {
    const service = { deleteDependency: vi.fn(async () => {}), getPhaseGraph: vi.fn(async () => tree('20')) }
    const store = createWorkflowStore(service as unknown as IWorkflowService)
    store.setState({ currentProjectId: '7' })
    await store.getState().removeDependency('20', '5', '6')
    expect(service.deleteDependency).toHaveBeenCalledWith('20', '5', '6')
    expect(service.getPhaseGraph).toHaveBeenCalledWith('20', '7')
  })
})
