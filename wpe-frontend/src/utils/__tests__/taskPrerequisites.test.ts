import { describe, it, expect } from 'vitest'
import { isUnlockSatisfied, prerequisitesOf } from '../taskPrerequisites'
import type { BranchGraphNode, GraphNodeMap } from '../../types/workflow.types'

/** T6 — danh sách task đứng trước cho khung điều kiện trong hộp Chi tiết task. */

function branch(id: string, status: BranchGraphNode['status'], parentIds: string[]): BranchGraphNode {
  return {
    kind: 'branch', id, code: `WPE-${id}`, title: `Task ${id}`, description: '', isTrack: false, status,
    assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds,
  }
}

const TREE: GraphNodeMap = {
  root_20: { id: 'root_20', kind: 'root', title: 'P', parentIds: [] },
  a: branch('a', 'DONE', ['root_20']),
  b: branch('b', 'TODO', ['root_20']),
  c: branch('c', 'LOCKED', ['a', 'b']),
  ghost_9_to_c: {
    id: 'ghost_9_to_c', kind: 'ghost', refPhase: '10', refId: '9', dir: 'up', targetTaskId: 'c', title: 'Hạ tầng',
    parentIds: [], status: 'IN_PROGRESS', sourceTaskTitle: 'Hạ tầng', sourceTaskCode: 'WPE-009', sourcePhaseTitle: 'IaC',
  },
}

describe('prerequisitesOf', () => {
  it('gồm task cha cùng phase và task ở phase khác (ghost); không tính gốc phase', () => {
    expect(prerequisitesOf(TREE, 'c')).toEqual([
      { id: 'a', code: 'WPE-a', title: 'Task a', done: true, external: false },
      { id: 'b', code: 'WPE-b', title: 'Task b', done: false, external: false },
      { id: '9', code: 'WPE-009', title: 'Hạ tầng', done: false, external: true, phaseTitle: 'IaC' },
    ])
    expect(prerequisitesOf(TREE, 'a')).toEqual([])
  })
})

describe('isUnlockSatisfied', () => {
  const prereqs = prerequisitesOf(TREE, 'c')

  it('cần tất cả: còn task chưa xong thì chưa thỏa; chỉ cần 1: có một task xong là thỏa', () => {
    expect(isUnlockSatisfied(prereqs, 'ALL_COMPLETED')).toBe(false)
    expect(isUnlockSatisfied(prereqs, 'ANY_COMPLETED')).toBe(true)
  })

  it('không có task trước thì coi như thỏa', () => {
    expect(isUnlockSatisfied([], 'ALL_COMPLETED')).toBe(true)
  })
})
