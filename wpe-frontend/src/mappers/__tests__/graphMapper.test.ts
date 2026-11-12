import { describe, it, expect } from 'vitest'
import { toCreatedMacroPhase, toMacroPhases, toPhaseEdges, toPhaseTree, rootIdOf, ghostIdOf } from '../graphMapper'
import type { BackendGraphResponse, BranchGraphNode, GhostGraphNode } from '../../types/workflow.types'

// Dữ liệu giống seed: alex là owner, sarah (id 3) phụ trách WPE-002
const GRAPH: BackendGraphResponse = {
  phases: [
    { id: '10', name: 'PHASE 1', sub: 'Phân tích', accent: 'emerald', orderIndex: 0, parentPhaseIds: [], status: 'COMPLETED', progressPct: 100, uiMetadata: {} },
    { id: '20', name: 'PHASE 2', sub: 'Thiết kế', accent: 'blue', orderIndex: 1, parentPhaseIds: ['10'], status: 'IN_PROGRESS', progressPct: 50, uiMetadata: {} },
    { id: '30', name: 'PHASE 3', sub: 'Xây dựng', orderIndex: 2, parentPhaseIds: ['10', '20'], status: 'LOCKED', progressPct: 0, uiMetadata: { x: 900, y: 320, w: 260, h: 128 } },
  ],
  phaseEdges: [['10', '20'], ['10', '30'], ['20', '30']],
  nodes: [
    { id: '1', phaseId: '10', code: 'WPE-001', title: 'Thu thập yêu cầu', status: 'DONE', joinPolicy: 'ALL_COMPLETED', assignedUserId: '2', dueDate: '2026-11-20T00:00:00Z', uiMetadata: { position: { x: 300, y: 120 }, width: 240, height: 100 } },
    { id: '2', phaseId: '20', code: 'WPE-002', title: 'Thiết kế API', status: 'TODO', joinPolicy: 'ANY_COMPLETED', assignedUserId: '3', uiMetadata: {} },
    { id: '3', phaseId: '20', code: 'WPE-003', title: 'Thiết kế DB', status: 'LOCKED' },
    { id: '4', phaseId: null, code: 'WPE-004', title: 'Họp kickoff', status: 'TODO' },
    { id: '5', phaseId: '30', code: 'WPE-005', title: 'Code backend', status: 'LOCKED' },
  ],
  dependencies: [
    { parentNodeId: '1', childNodeId: '2' }, // khác phase -> ghost trong PHASE 2
    { parentNodeId: '2', childNodeId: '3' }, // cùng phase -> không phải ghost
    { parentNodeId: '3', childNodeId: '5' }, // khác phase -> ghost trong PHASE 3
  ],
}

describe('graphMapper.toMacroPhases', () => {
  it('đồ thị rỗng hoặc null thì trả mảng rỗng', () => {
    expect(toMacroPhases({ phases: [], phaseEdges: [], nodes: [], dependencies: [] })).toEqual([])
    expect(toMacroPhases(null)).toEqual([])
    expect(toMacroPhases({})).toEqual([])
  })

  it('đổi đủ trường của phase: id chuỗi, tiến độ, trạng thái, khóa', () => {
    const [p1, p2, p3] = toMacroPhases(GRAPH)
    expect(p1).toMatchObject({ id: '10', name: 'PHASE 1', sub: 'Phân tích', accent: 'emerald', status: 'COMPLETED', pct: 100, locked: false, w: 260, h: 128 })
    expect(p2).toMatchObject({ status: 'IN_PROGRESS', pct: 50, locked: false })
    expect(p3).toMatchObject({ status: 'LOCKED', locked: true, accent: 'slate' })
  })

  it('phase nhiều cha giữ đủ danh sách parentPhaseIds dạng chuỗi', () => {
    const phases = toMacroPhases({ phases: [{ id: 30, name: 'P3', parentPhaseIds: [10, 20] }] })
    expect(phases[0].parentPhaseIds).toEqual(['10', '20'])
  })

  it('phase chưa kéo (uiMetadata rỗng) xếp ngang theo orderIndex: x = 60 + orderIndex*360, y = 80', () => {
    const [p1, p2] = toMacroPhases(GRAPH)
    expect([p1.x, p1.y]).toEqual([60, 80])
    expect([p2.x, p2.y]).toEqual([420, 80])
  })

  it('phase đã kéo thả (uiMetadata có x, y) dùng đúng vị trí đã lưu, để F5 không mất vị trí', () => {
    const p3 = toMacroPhases(GRAPH)[2]
    expect([p3.x, p3.y]).toEqual([900, 320])
  })

  it('uiMetadata x/y không phải số thì bỏ qua, dùng vị trí mặc định', () => {
    const [p] = toMacroPhases({ phases: [{ id: 1, name: 'P', orderIndex: 1, uiMetadata: { x: 'abc', y: null } }] })
    expect([p.x, p.y]).toEqual([420, 80])
  })

  it('thiếu sub, accent, status, progressPct thì dùng giá trị mặc định', () => {
    const [p] = toMacroPhases({ phases: [{ id: 7, name: 'P' }] })
    expect(p).toMatchObject({ sub: '', accent: 'slate', status: 'TODO', pct: 0, parentPhaseIds: [], locked: false, x: 60 })
  })
})

describe('graphMapper.toCreatedMacroPhase', () => {
  it('phase mới có phase cha thì bị khóa, chưa có task nên TODO 0%', () => {
    const p = toCreatedMacroPhase({ id: 40, name: 'PHASE 4', orderIndex: 3, parentPhaseIds: [30] })
    expect(p).toMatchObject({ id: '40', status: 'TODO', pct: 0, locked: true, parentPhaseIds: ['30'], x: 60 + 3 * 360, y: 80 })
  })

  it('vị trí truyền vào ưu tiên hơn vị trí mặc định', () => {
    const p = toCreatedMacroPhase({ id: 40, name: 'PHASE 4', orderIndex: 3 }, { x: 15, y: 25 })
    expect([p.x, p.y, p.locked]).toEqual([15, 25, false])
  })
})

describe('graphMapper.toPhaseEdges', () => {
  it('đổi cạnh phase sang cặp chuỗi [cha, con]', () => {
    expect(toPhaseEdges({ phaseEdges: [[10, 20], ['20', 30]] })).toEqual([['10', '20'], ['20', '30']])
  })

  it('không có cạnh thì trả mảng rỗng', () => {
    expect(toPhaseEdges({})).toEqual([])
    expect(toPhaseEdges(undefined)).toEqual([])
  })
})

describe('graphMapper.toPhaseTree', () => {
  it('không tìm thấy phase thì trả null (lớp gọi API sẽ báo lỗi 404)', () => {
    expect(toPhaseTree(GRAPH, '999')).toBeNull()
    expect(toPhaseTree(null, '10')).toBeNull()
  })

  it('phase chưa có node thì cây chỉ có root mang tên phase', () => {
    const tree = toPhaseTree({ phases: [{ id: 50, name: 'PHASE 5' }], nodes: [], dependencies: [] }, '50')!
    expect(Object.keys(tree)).toEqual(['root_50'])
    expect(tree['root_50']).toEqual({ id: 'root_50', kind: 'root', title: 'PHASE 5', parentIds: [], x: 80, y: 200 })
  })

  it('node của phase thành Branch treo dưới root, đủ trường', () => {
    const tree = toPhaseTree(GRAPH, '10')!
    const b = tree['1'] as BranchGraphNode
    expect(b).toMatchObject({
      kind: 'branch', code: 'WPE-001', title: 'Thu thập yêu cầu', status: 'DONE', assignee: '2',
      due: '2026-11-20', joinPolicy: 'ALL_COMPLETED', phaseId: '10', parentIds: [rootIdOf('10')],
      isTrack: false, x: 300, y: 120, width: 240, height: 100,
    })
  })

  it('node thiếu uiMetadata, người phụ trách, trạng thái thì dùng mặc định', () => {
    const b = toPhaseTree(GRAPH, '20')!['3'] as BranchGraphNode
    expect(b).toMatchObject({ assignee: null, due: null, x: 280, y: 180, width: 220, height: 90, joinPolicy: 'ALL_COMPLETED', description: '' })
    const noStatus = toPhaseTree({ phases: [{ id: 1, name: 'P' }], nodes: [{ id: 9, phaseId: 1, code: 'X', title: 'X' }] }, '1')!['9'] as BranchGraphNode
    expect(noStatus.status).toBe('LOCKED')
  })

  it('node độc lập (không thuộc phase nào) không xuất hiện trong cây của phase', () => {
    for (const phaseId of ['10', '20', '30']) {
      expect(toPhaseTree(GRAPH, phaseId)!['4']).toBeUndefined()
    }
  })

  it('ghost: cạnh có cha ở phase khác tạo ghost gắn vào node con', () => {
    const tree = toPhaseTree(GRAPH, '20')!
    const ghost = tree[ghostIdOf('1', '2')] as GhostGraphNode
    expect(ghost).toEqual({
      id: 'ghost_1_to_2', kind: 'ghost', refPhase: '10', refId: '1', dir: 'up', targetTaskId: '2',
      title: 'Thu thập yêu cầu', parentIds: [], sourceTaskTitle: 'Thu thập yêu cầu', sourcePhaseTitle: 'PHASE 1',
    })
  })

  it('cạnh cùng phase không tạo ghost', () => {
    const tree = toPhaseTree(GRAPH, '20')!
    expect(Object.values(tree).filter((n) => n.kind === 'ghost').map((n) => n.id)).toEqual(['ghost_1_to_2'])
  })

  it('ghost chỉ nằm trong cây của phase chứa node con, không nằm ở phase của node cha', () => {
    expect(Object.values(toPhaseTree(GRAPH, '10')!).some((n) => n.kind === 'ghost')).toBe(false)
    expect(toPhaseTree(GRAPH, '30')![ghostIdOf('3', '5')]).toMatchObject({ refPhase: '20', targetTaskId: '5' })
  })

  it('cạnh trỏ tới node cha không tồn tại thì bỏ qua, không tạo ghost rỗng', () => {
    const graph: BackendGraphResponse = { ...GRAPH, dependencies: [{ parentNodeId: '999', childNodeId: '2' }] }
    expect(Object.values(toPhaseTree(graph, '20')!).some((n) => n.kind === 'ghost')).toBe(false)
  })
})
