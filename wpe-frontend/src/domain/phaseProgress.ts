import type { BranchGraphNode, GraphNodeMap, MacroPhase, NodeStatus, PhaseStatus } from '../types/workflow.types'

export interface PhaseProgress {
  pct: number
  status: PhaseStatus
  totalTasks: number
  doneTasks: number
}

const isTask = (n: GraphNodeMap[string] | undefined): n is BranchGraphNode =>
  n?.kind === 'branch' && !n.isTrack

/**
 * Tiến độ = số task DONE / tổng số task (làm tròn %).
 * Trạng thái suy ra từ task (khớp engine backend):
 *   không có task -> TODO, tất cả DONE -> COMPLETED, tất cả LOCKED -> LOCKED,
 *   có task IN_PROGRESS/REVIEW/DONE -> IN_PROGRESS, còn lại -> TODO.
 */
function summarize(tasks: BranchGraphNode[]): PhaseProgress {
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  let status: PhaseStatus
  if (totalTasks === 0) status = 'TODO'
  else if (doneTasks === totalTasks) status = 'COMPLETED'
  else if (tasks.every((t) => t.status === 'LOCKED')) status = 'LOCKED'
  else if (tasks.some((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'DONE')) status = 'IN_PROGRESS'
  else status = 'TODO'

  return { pct, status, totalTasks, doneTasks }
}

/** Tiến độ Phase: chỉ tính task thật của Phase, bỏ root, Track (nhóm) và Ghost (task của Phase khác). */
export function computePhaseProgress(nodes: GraphNodeMap | undefined): PhaseProgress {
  return summarize(Object.values(nodes ?? {}).filter(isTask))
}

/** Gắn pct / status / locked đã suy ra từ cây task vào MacroPhase. */
export function withPhaseProgress(phase: MacroPhase, nodes: GraphNodeMap | undefined): MacroPhase {
  const { pct, status } = computePhaseProgress(nodes)
  return { ...phase, pct, status, locked: status === 'LOCKED' }
}

/** Track chứa task: ưu tiên trackId, nếu không thì đi ngược parentIds tới Track gần nhất. */
function findTrackId(task: BranchGraphNode, nodes: GraphNodeMap): string | null {
  const direct = task.trackId ? nodes[task.trackId] : undefined
  if (direct?.kind === 'branch' && direct.isTrack) return direct.id

  const queue = [...task.parentIds]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const parent = nodes[id]
    if (parent?.kind !== 'branch') continue
    if (parent.isTrack) return parent.id
    queue.push(...parent.parentIds)
  }
  return null
}

/**
 * Track chỉ là nhóm đặt tên: trạng thái & tiến độ của Track luôn suy ra từ các task bên trong,
 * cùng luật với Phase (COMPLETED của Phase tương ứng DONE của Track).
 * Trả về chính `nodes` nếu không có gì thay đổi.
 */
export function syncTrackProgress(nodes: GraphNodeMap): GraphNodeMap {
  const tasksByTrack: Record<string, BranchGraphNode[]> = {}
  for (const n of Object.values(nodes)) {
    if (!isTask(n)) continue
    const trackId = findTrackId(n, nodes)
    if (trackId) (tasksByTrack[trackId] ??= []).push(n)
  }

  let changed = false
  const next: GraphNodeMap = { ...nodes }
  for (const n of Object.values(nodes)) {
    if (n.kind !== 'branch' || !n.isTrack) continue
    const { pct, status } = summarize(tasksByTrack[n.id] ?? [])
    const trackStatus: NodeStatus = status === 'COMPLETED' ? 'DONE' : status
    if (n.status !== trackStatus || n.progress !== pct) {
      next[n.id] = { ...n, status: trackStatus, progress: pct }
      changed = true
    }
  }
  return changed ? next : nodes
}
