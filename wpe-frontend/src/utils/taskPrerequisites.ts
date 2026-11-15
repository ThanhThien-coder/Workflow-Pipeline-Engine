import type { GraphNodeMap, JoinPolicy } from '../types/workflow.types'

/** Một task đứng trước (task này phải chờ nó). */
export interface Prerequisite {
  id: string
  code: string
  title: string
  done: boolean
  /** Task ở phase khác (ghost). */
  external: boolean
  phaseTitle?: string
}

/**
 * Các task đứng trước của một task: task cha cùng phase (parentIds) và task ở phase khác (ghost gắn vào task này).
 * Gốc phase không tính.
 */
export function prerequisitesOf(tree: GraphNodeMap, nodeId: string): Prerequisite[] {
  const node = tree[nodeId]
  if (!node) return []
  const samePhase: Prerequisite[] = node.parentIds
    .map((id) => tree[id])
    .filter((parent): parent is Extract<GraphNodeMap[string], { kind: 'branch' }> => parent?.kind === 'branch')
    .map((parent) => ({ id: parent.id, code: parent.code, title: parent.title, done: parent.status === 'DONE', external: false }))
  const otherPhase: Prerequisite[] = Object.values(tree)
    .filter((n): n is Extract<GraphNodeMap[string], { kind: 'ghost' }> => n.kind === 'ghost' && n.targetTaskId === nodeId)
    .map((ghost) => ({
      id: ghost.refId,
      code: ghost.sourceTaskCode ?? '',
      title: ghost.sourceTaskTitle ?? ghost.title,
      done: ghost.status === 'DONE',
      external: true,
      phaseTitle: ghost.sourcePhaseTitle,
    }))
  return [...samePhase, ...otherPhase]
}

/** Điều kiện mở khóa đã thỏa chưa: cần tất cả (AND) hay chỉ cần 1 (OR). Không có task trước thì coi như thỏa. */
export function isUnlockSatisfied(prerequisites: Prerequisite[], joinPolicy: JoinPolicy | 'AND' | null): boolean {
  if (prerequisites.length === 0) return true
  return joinPolicy === 'ANY_COMPLETED' ? prerequisites.some((p) => p.done) : prerequisites.every((p) => p.done)
}
