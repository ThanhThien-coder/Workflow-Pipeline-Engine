import { describe, it, expect } from 'vitest'
import {
  calculatePhaseGraphLayout,
  calculateDeterministicLayout,
  createNewBranchNode,
  childrenOfPrimary,
  isAncestor,
  GAP_X,
  W,
  ROOT_H,
  TRACK_H,
  TASK_H,
} from '../spanningTreeLayout'
import type { GraphNodeMap, RootGraphNode, BranchGraphNode, GhostGraphNode } from '../../types/workflow.types'

describe('spanningTreeLayout & Deterministic Layout Engine', () => {
  const initialNodes: GraphNodeMap = {
    root: {
      kind: 'root',
      id: 'root',
      title: 'Phase 2A Root',
      parentIds: [],
    } as RootGraphNode,
    'trk-1': {
      kind: 'branch',
      id: 'trk-1',
      code: 'TRK-01',
      title: 'Database Track',
      isTrack: true,
      status: 'TODO',
      parentIds: ['root'],
      parentId: 'root',
      trackId: 'trk-1',
      level: 1,
      order: 0,
      description: '',
      assignee: null,
      due: null,
      blocker: null,
      joinPolicy: null,
    } as BranchGraphNode,
    'task-1': {
      kind: 'branch',
      id: 'task-1',
      code: 'WPE-101',
      title: 'Design DB Schema',
      isTrack: false,
      status: 'DONE',
      parentIds: ['trk-1'],
      parentId: 'trk-1',
      trackId: 'trk-1',
      level: 2,
      order: 0,
      description: '',
      assignee: 'Sarah',
      due: null,
      blocker: null,
      joinPolicy: null,
    } as BranchGraphNode,
  }

  describe('createNewBranchNode', () => {
    it('creates a new track when source is root or null', () => {
      const newTrack = createNewBranchNode(initialNodes.root, initialNodes, 'p2a')

      expect(newTrack.kind).toBe('branch')
      expect(newTrack.isTrack).toBe(true)
      expect(newTrack.trackId).toBe(newTrack.id)
      expect(newTrack.parentId).toBe('root')
      expect(newTrack.parentIds).toEqual(['root'])
      expect(newTrack.level).toBe(1)
      expect(newTrack.order).toBe(1) // Existing had 1 track
      expect(newTrack.phaseId).toBe('p2a')
      expect(newTrack.code).toMatch(/^TRK-\d{2}$/)
      expect(newTrack.title).toBeDefined()
      expect(Number.isFinite(newTrack.level)).toBe(true)
      expect(Number.isFinite(newTrack.order)).toBe(true)
    })

    it('creates a new task attached to a track', () => {
      const trackNode = initialNodes['trk-1']
      const newTask = createNewBranchNode(trackNode, initialNodes, 'p2a', 'API Endpoint Auth')

      expect(newTask.kind).toBe('branch')
      expect(newTask.isTrack).toBe(false)
      expect(newTask.trackId).toBe('trk-1')
      expect(newTask.parentId).toBe('trk-1')
      expect(newTask.parentIds).toEqual(['trk-1'])
      expect(newTask.level).toBe(2)
      expect(newTask.order).toBe(1) // One existing task under trk-1
      expect(newTask.title).toBe('API Endpoint Auth')
      expect(newTask.code).toMatch(/^WPE-\d+$/)
      expect(newTask.phaseId).toBe('p2a')
      expect(Number.isFinite(newTask.level)).toBe(true)
      expect(Number.isFinite(newTask.order)).toBe(true)
    })

    it('creates a child subtask when spawned from an existing task (Multi-level Tree Expansion)', () => {
      const parentTask = initialNodes['task-1']
      const subtask = createNewBranchNode(parentTask, initialNodes, 'p2a')

      expect(subtask.isTrack).toBe(false)
      expect(subtask.trackId).toBe('trk-1') // Inherits trackId
      expect(subtask.parentId).toBe('task-1') // Child of parent task!
      expect(subtask.parentIds).toEqual(['task-1'])
      expect(subtask.level).toBe(3) // Level 3 (Subtask)
      expect(subtask.order).toBe(0) // First child under task-1
      expect(subtask.status).toBe('TODO') // Since source task is DONE
    })

    it('locks child task if parent task is not yet DONE', () => {
      const incompleteTask: BranchGraphNode = {
        ...(initialNodes['task-1'] as BranchGraphNode),
        id: 'task-incomplete',
        status: 'IN_PROGRESS',
      }
      const nodesWithIncomplete = { ...initialNodes, 'task-incomplete': incompleteTask }
      const child = createNewBranchNode(incompleteTask, nodesWithIncomplete, 'p2a')

      expect(child.status).toBe('LOCKED')
      expect(child.blocker).toContain(incompleteTask.title)
    })
  })

  describe('calculateDeterministicLayout', () => {
    it('produces dynamic, level-based deterministic coordinates (Tidy Tree)', () => {
      const layout = calculateDeterministicLayout(initialNodes)

      // TASK_73 (#16): root ảo bị ẩn, không có trong bố cục
      expect(layout['root']).toBeUndefined()

      // Track validation: cột đầu tiên, Level 0 (X = 40)
      expect(layout['trk-1']).toBeDefined()
      expect(layout['trk-1'].x).toBe(40)
      expect(Number.isFinite(layout['trk-1'].y)).toBe(true)
      expect(layout['trk-1'].level).toBe(0)
      expect(layout['trk-1'].order).toBe(0)

      // Task validation: Level 1 (X = 320)
      expect(layout['task-1']).toBeDefined()
      expect(layout['task-1'].x).toBe(320)
      expect(layout['task-1'].y).toBe(60)
      expect(layout['task-1'].level).toBe(1)
      expect(layout['task-1'].order).toBe(0)

      // Center and edge anchors must be finite numbers
      Object.values(layout).forEach((pos) => {
        expect(Number.isFinite(pos.x)).toBe(true)
        expect(Number.isFinite(pos.y)).toBe(true)
        expect(Number.isFinite(pos.left)).toBe(true)
        expect(Number.isFinite(pos.right)).toBe(true)
        expect(Number.isFinite(pos.centerY)).toBe(true)
        expect(isNaN(pos.x)).toBe(false)
        expect(isNaN(pos.y)).toBe(false)
        expect(isNaN(pos.centerY)).toBe(false)
      })
    })

    it('positions consecutive tasks in a track with deterministic vertical spacing', () => {
      const task2 = createNewBranchNode(initialNodes['trk-1'], initialNodes, 'p2a', 'Second Task')
      const updatedNodes: GraphNodeMap = {
        ...initialNodes,
        [task2.id]: task2,
      }

      const layout = calculateDeterministicLayout(updatedNodes)

      const pos1 = layout['task-1']
      const pos2 = layout[task2.id]

      expect(pos1.x).toBe(320)
      expect(pos2.x).toBe(320)
      expect(pos2.y).toBe(pos1.y + TASK_H + 16)
      expect(pos2.centerY).toBe(pos2.y + TASK_H / 2)
    })

    it('supports infinite branching to Level 3, 4 with dynamic X expansion', () => {
      const subtask = createNewBranchNode(initialNodes['task-1'], initialNodes, 'p2a', 'Subtask Level 3')
      const nodesWithL3 = { ...initialNodes, [subtask.id]: subtask }
      const subsubtask = createNewBranchNode(subtask, nodesWithL3, 'p2a', 'Subtask Level 4')
      const nodesWithL4 = { ...nodesWithL3, [subsubtask.id]: subsubtask }

      const layout = calculateDeterministicLayout(nodesWithL4)

      expect(layout[subtask.id].x).toBe(600) // Level 2: 40 + 2 * 280 (root ẩn nên cột đầu là level 0)
      expect(layout[subtask.id].level).toBe(2)

      expect(layout[subsubtask.id].x).toBe(880) // Level 3: 40 + 3 * 280
      expect(layout[subsubtask.id].level).toBe(3)
    })

    it('prevents NaN when node has corrupted or missing properties', () => {
      const corruptedNodes: GraphNodeMap = {
        root: { kind: 'root', id: 'root', title: 'Root', parentIds: [] } as RootGraphNode,
        corrupted: {
          kind: 'branch',
          id: 'corrupted',
          code: '',
          title: 'Corrupted',
          isTrack: false,
          status: 'TODO',
          parentIds: ['unknown'],
          description: '',
          assignee: null,
          due: null,
          blocker: null,
          joinPolicy: null,
          x: NaN,
          y: NaN,
          level: undefined,
          order: undefined,
        } as unknown as BranchGraphNode,
      }

      const layout = calculateDeterministicLayout(corruptedNodes)
      const corruptedPos = layout['corrupted']

      expect(corruptedPos).toBeDefined()
      expect(Number.isFinite(corruptedPos.x)).toBe(true)
      expect(Number.isFinite(corruptedPos.y)).toBe(true)
      expect(isNaN(corruptedPos.x)).toBe(false)
      expect(isNaN(corruptedPos.y)).toBe(false)
      expect(corruptedPos.x).toBeGreaterThan(0)
    })
  })

  describe('isAncestor & childrenOfPrimary', () => {
    it('accurately identifies primary children', () => {
      const kids = childrenOfPrimary(initialNodes, 'trk-1')
      expect(kids).toHaveLength(1)
      expect(kids[0].id).toBe('task-1')
    })

    it('detects ancestral loops to avoid graph cycle explosion', () => {
      expect(isAncestor(initialNodes, 'trk-1', 'task-1')).toBe(true)
      expect(isAncestor(initialNodes, 'task-1', 'trk-1')).toBe(false)
    })
  })

  describe('TASK_73: root ẩn, ghost là cha nằm bên trái', () => {
    const task = (id: string, parentIds: string[], extra: Partial<BranchGraphNode> = {}): BranchGraphNode => ({
      kind: 'branch', id, code: id, title: id, isTrack: false, status: 'TODO', parentIds,
      description: '', assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', ...extra,
    } as BranchGraphNode)
    const ghost = (id: string, targetTaskId: string): GhostGraphNode => ({
      id, kind: 'ghost', refPhase: '5', refId: `src-${id}`, dir: 'up', title: id, parentIds: [], targetTaskId,
    } as GhostGraphNode)
    const root: RootGraphNode = { kind: 'root', id: 'root_1', title: 'P', parentIds: [] } as RootGraphNode

    it('không có node root trong layoutNodes và không có dây đi ra từ root', () => {
      const nodes: GraphNodeMap = { root_1: root, a: task('a', ['root_1']), b: task('b', ['a']) }
      const { layoutNodes, layoutEdges } = calculatePhaseGraphLayout(nodes)

      expect(layoutNodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
      expect(layoutEdges.some((e) => e.sourceId === 'root_1' || e.targetId === 'root_1')).toBe(false)
      // Task không có cha trong phase là cột đầu tiên, canh trái
      const layout = Object.fromEntries(layoutNodes.map((n) => [n.id, n]))
      expect(layout.a.x).toBe(40)
      expect(layout.b.x).toBe(320)
      // Chỉ còn dây a -> b, và đó là phụ thuộc thật
      expect(layoutEdges).toHaveLength(1)
      expect(layoutEdges[0]).toMatchObject({ sourceId: 'a', targetId: 'b', isDependency: true })
    })

    it('ghost nằm bên trái task đích (x + width <= x của task), dây đi ghost -> task', () => {
      const nodes: GraphNodeMap = { root_1: root, a: task('a', ['root_1']), g1: ghost('g1', 'a') }
      const { layoutNodes, layoutEdges } = calculatePhaseGraphLayout(nodes)
      const g = layoutNodes.find((n) => n.id === 'g1')!
      const a = layoutNodes.find((n) => n.id === 'a')!

      expect(g.type).toBe('ghost')
      expect(g.x + g.width).toBeLessThanOrEqual(a.x)
      expect(g.x).toBe(40) // task chỉ có cha là ghost: ghost đứng ở cột đầu, task ở cột kế
      const edge = layoutEdges.find((e) => e.isGhost)!
      expect(edge).toMatchObject({ sourceId: 'g1', targetId: 'a', isDependency: true })
      expect(edge.d.startsWith(`M ${g.right} ${g.centerY}`)).toBe(true)
      expect(edge.d.endsWith(`${a.left} ${a.centerY}`)).toBe(true)
    })

    it('nhiều ghost cùng task xếp dọc, không đè nhau và không đè thẻ khác (kể cả cha thật của task)', () => {
      const nodes: GraphNodeMap = {
        root_1: root,
        p: task('p', ['root_1']),
        t: task('t', ['p']),
        s: task('s', ['p']),
        u: task('u', ['root_1']),
        g1: ghost('g1', 't'),
        g2: ghost('g2', 't'),
        g3: ghost('g3', 't'),
      }
      const { layoutNodes } = calculatePhaseGraphLayout(nodes)
      const byId = Object.fromEntries(layoutNodes.map((n) => [n.id, n]))

      const overlaps = (a: typeof byId[string], b: typeof byId[string]) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
      const all = layoutNodes
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(overlaps(all[i], all[j]), `${all[i].id} đè ${all[j].id}`).toBe(false)
        }
      }
      ;['g1', 'g2', 'g3'].forEach((id) => expect(byId[id].x + byId[id].width).toBeLessThanOrEqual(byId.t.x))
      expect(byId.g2.y).toBeGreaterThan(byId.g1.y + byId.g1.height - 1)
      expect(byId.g3.y).toBeGreaterThan(byId.g2.y + byId.g2.height - 1)
    })

    it('dây phụ thuộc thật (task -> task) đánh dấu isDependency, dây track thì không', () => {
      const { layoutEdges } = calculatePhaseGraphLayout(initialNodes)
      // root -> track không còn; track -> task là dây cấu trúc
      expect(layoutEdges).toHaveLength(1)
      expect(layoutEdges[0]).toMatchObject({ sourceId: 'trk-1', targetId: 'task-1', isDependency: false })
    })
  })
})
