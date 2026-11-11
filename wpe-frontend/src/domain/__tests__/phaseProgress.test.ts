import { describe, expect, it } from 'vitest'
import { computePhaseProgress, syncTrackProgress, withPhaseProgress } from '../phaseProgress'
import type { BranchGraphNode, GraphNodeMap, MacroPhase, NodeStatus } from '../../types/workflow.types'

const root: GraphNodeMap = { root: { id: 'root', kind: 'root', parentIds: [], title: 'Root' } }

function task(id: string, status: NodeStatus, isTrack = false): BranchGraphNode {
  return {
    id, kind: 'branch', code: id, title: id, description: '', isTrack, status,
    assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root'],
  }
}

function tree(...nodes: BranchGraphNode[]): GraphNodeMap {
  return { ...root, ...Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

describe('computePhaseProgress', () => {
  it('phase rỗng (chỉ có root) -> 0% và TODO', () => {
    expect(computePhaseProgress(root)).toEqual({ pct: 0, status: 'TODO', totalTasks: 0, doneTasks: 0 })
    expect(computePhaseProgress(undefined).pct).toBe(0)
  })

  it('bỏ qua Track và Ghost khi đếm', () => {
    const nodes: GraphNodeMap = {
      ...tree(task('trk', 'DONE', true), task('t1', 'DONE')),
      g1: { id: 'g1', kind: 'ghost', parentIds: [], title: 'Ghost', refPhase: 'p0', refId: 'x', dir: 'up', status: 'TODO' },
    }
    expect(computePhaseProgress(nodes)).toMatchObject({ pct: 100, totalTasks: 1, doneTasks: 1, status: 'COMPLETED' })
  })

  it('chỉ có Track mà không có task -> TODO 0%', () => {
    expect(computePhaseProgress(tree(task('trk', 'IN_PROGRESS', true)))).toMatchObject({ pct: 0, status: 'TODO' })
  })

  it('chỉ đếm DONE: IN_PROGRESS / REVIEW vẫn là 0%', () => {
    expect(computePhaseProgress(tree(task('t1', 'IN_PROGRESS'))).pct).toBe(0)
    expect(computePhaseProgress(tree(task('t1', 'REVIEW'))).pct).toBe(0)
  })

  it('làm tròn phần trăm', () => {
    expect(computePhaseProgress(tree(task('a', 'DONE'), task('b', 'TODO'), task('c', 'TODO'))).pct).toBe(33)
    expect(computePhaseProgress(tree(task('a', 'DONE'), task('b', 'DONE'), task('c', 'TODO'))).pct).toBe(67)
  })

  it('suy ra trạng thái Phase từ task', () => {
    expect(computePhaseProgress(tree(task('a', 'LOCKED'), task('b', 'LOCKED'))).status).toBe('LOCKED')
    expect(computePhaseProgress(tree(task('a', 'TODO'), task('b', 'LOCKED'))).status).toBe('TODO')
    expect(computePhaseProgress(tree(task('a', 'REVIEW'), task('b', 'LOCKED'))).status).toBe('IN_PROGRESS')
    expect(computePhaseProgress(tree(task('a', 'DONE'), task('b', 'LOCKED'))).status).toBe('IN_PROGRESS')
    expect(computePhaseProgress(tree(task('a', 'DONE'), task('b', 'DONE'))).status).toBe('COMPLETED')
  })
})

describe('syncTrackProgress', () => {
  const inTrack = (id: string, status: NodeStatus, trackId: string): BranchGraphNode =>
    ({ ...task(id, status), trackId, parentIds: [trackId] })

  it('Track đi theo task con: 1 task DONE -> Track DONE 100%', () => {
    const nodes = syncTrackProgress(tree(task('trk', 'TODO', true), inTrack('t1', 'DONE', 'trk')))
    expect(nodes.trk).toMatchObject({ status: 'DONE', progress: 100 })
  })

  it('mỗi Track chỉ tính task của chính nó', () => {
    const nodes = syncTrackProgress(tree(
      task('a', 'DONE', true), task('b', 'DONE', true), task('c', 'TODO', true),
      inTrack('a1', 'IN_PROGRESS', 'a'),
      inTrack('b1', 'DONE', 'b'), inTrack('b2', 'TODO', 'b'),
      inTrack('c1', 'LOCKED', 'c'),
    ))
    expect(nodes.a).toMatchObject({ status: 'IN_PROGRESS', progress: 0 })
    expect(nodes.b).toMatchObject({ status: 'IN_PROGRESS', progress: 50 })
    expect(nodes.c).toMatchObject({ status: 'LOCKED', progress: 0 })
  })

  it('task con nhiều cấp (subtask) vẫn tính cho Track qua parentIds', () => {
    const sub: BranchGraphNode = { ...task('s1', 'DONE'), parentIds: ['t1'] }
    const nodes = syncTrackProgress(tree(task('trk', 'TODO', true), inTrack('t1', 'DONE', 'trk'), sub))
    expect(nodes.trk).toMatchObject({ status: 'DONE', progress: 100 })
  })

  it('Track chưa có task -> TODO 0%', () => {
    expect(syncTrackProgress(tree(task('trk', 'DONE', true))).trk).toMatchObject({ status: 'TODO', progress: 0 })
  })

  it('không đổi gì thì trả lại đúng object cũ', () => {
    const nodes = tree({ ...task('trk', 'DONE', true), progress: 100 }, inTrack('t1', 'DONE', 'trk'))
    expect(syncTrackProgress(nodes)).toBe(nodes)
  })
})

describe('withPhaseProgress', () => {
  const phase: MacroPhase = {
    id: 'p1', name: 'PHASE 1', sub: '', status: 'IN_PROGRESS', pct: 100, accent: 'blue',
    x: 0, y: 0, w: 100, h: 100, parentPhaseIds: [], locked: false,
  }

  it('ghi đè số cũ bằng giá trị suy ra và đồng bộ cờ locked', () => {
    expect(withPhaseProgress(phase, tree(task('a', 'LOCKED')))).toMatchObject({ pct: 0, status: 'LOCKED', locked: true })
    expect(withPhaseProgress(phase, root)).toMatchObject({ pct: 0, status: 'TODO', locked: false })
  })
})
