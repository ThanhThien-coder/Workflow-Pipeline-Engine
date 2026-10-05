import type { BranchGraphNode, GraphNode, GraphNodeMap, MacroPhase } from '../types/workflow.types'

export const COL_W = 250
export const GAP_X = 56
export const GAP_TRACK = 18
export const GAP = 10
export const ROOT_H = 60
export const TRACK_H = 58
export const TASK_H = 92
export const W = { track: 180, task: 220, root: 190, ghost: 220 } as const

export function childrenOf(nodes: GraphNodeMap, id: string): GraphNode[] {
  return Object.values(nodes).filter((node) => node.parentIds.includes(id))
}

export function isAncestor(nodes: GraphNodeMap, targetId: string, sourceId: string): boolean {
  const queue = [targetId]
  const seen = new Set(queue)
  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    if (current === sourceId) return true
    childrenOf(nodes, current).forEach((child) => {
      if (!seen.has(child.id)) {
        seen.add(child.id)
        queue.push(child.id)
      }
    })
  }
  return false
}

export function isPhaseAncestor(phases: Record<string, MacroPhase>, targetId: string, sourceId: string): boolean {
  const queue = [targetId]
  const visited = new Set(queue)
  while (queue.length) {
    const current = queue.shift()
    if (!current) continue
    if (current === sourceId) return true
    Object.values(phases).filter((phase) => phase.parentPhaseIds.includes(current)).forEach((child) => {
      if (!visited.has(child.id)) {
        visited.add(child.id)
        queue.push(child.id)
      }
    })
  }
  return false
}

export function primaryParentOf(nodes: GraphNodeMap, id: string): string | null {
  return nodes[id]?.parentIds[0] ?? null
}

export function childrenOfPrimary(nodes: GraphNodeMap, id: string): GraphNode[] {
  return Object.values(nodes).filter((node) => primaryParentOf(nodes, node.id) === id)
}

export function isLaneGhost(node: GraphNode): boolean {
  return node.kind === 'ghost' && node.parentIds[0] === 'root'
}

export function computeVisible(nodes: GraphNodeMap, collapsed: Set<string>): Record<string, boolean> {
  const cache: Record<string, boolean> = {}
  const visible = (id: string): boolean => {
    if (id in cache) return cache[id]
    if (id === 'root') return (cache[id] = true)
    const parent = primaryParentOf(nodes, id)
    return (cache[id] = parent ? visible(parent) && !collapsed.has(parent) : false)
  }
  Object.keys(nodes).forEach(visible)
  return cache
}

export function deleteNodeCascade(nodes: GraphNodeMap, id: string): GraphNodeMap {
  const next = { ...nodes }
  const removed = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    Object.keys(next).forEach((nodeId) => {
      if (removed.has(nodeId)) return
      const parentIds = next[nodeId].parentIds.filter((parentId) => !removed.has(parentId))
      if (parentIds.length !== next[nodeId].parentIds.length) next[nodeId] = { ...next[nodeId], parentIds }
    })
    Object.keys(next).forEach((nodeId) => {
      if (nodeId !== 'root' && !removed.has(nodeId) && next[nodeId].parentIds.length === 0) {
        removed.add(nodeId)
        changed = true
      }
    })
  }
  removed.forEach((nodeId) => delete next[nodeId])
  return next
}

const nodeHeight = (node: GraphNode): number => node.kind === 'root' ? ROOT_H : node.kind === 'branch' && node.isTrack ? TRACK_H : TASK_H

export function measureHeights(nodes: GraphNodeMap, id: string): number {
  const node = nodes[id]
  if (!node) return 0
  const children = childrenOfPrimary(nodes, id)
  if (!children.length) return nodeHeight(node)
  const childrenHeight = children.reduce((total, child) => total + measureHeights(nodes, child.id), 0) + GAP * (children.length - 1)
  return Math.max(nodeHeight(node), childrenHeight)
}

export interface LayoutPosition {
  x: number
  y: number
  width: number
  height: number
}

export type LayoutPositions = Record<string, LayoutPosition>

export function placeTree(nodes: GraphNodeMap, id: string, x: number, top: number, positions: LayoutPositions = {}): LayoutPositions {
  const node = nodes[id]
  if (!node) return positions
  const height = nodeHeight(node)
  const blockHeight = measureHeights(nodes, id)
  const y = top + (blockHeight - height) / 2
  const width = node.kind === 'root' ? W.root : node.kind === 'branch' && node.isTrack ? W.track : W.task
  positions[id] = { x, y, width, height }
  let childTop = top
  childrenOfPrimary(nodes, id).forEach((child) => {
    const childBlock = measureHeights(nodes, child.id)
    placeTree(nodes, child.id, x + width + GAP_X, childTop, positions)
    childTop += childBlock + GAP
  })
  return positions
}

export function depthsOf(nodes: GraphNodeMap): Record<string, number> {
  const depths: Record<string, number> = {}
  const depth = (id: string): number => {
    if (id in depths) return depths[id]
    const parent = primaryParentOf(nodes, id)
    return (depths[id] = parent && nodes[parent] ? depth(parent) + 1 : 0)
  }
  Object.keys(nodes).forEach(depth)
  return depths
}

export function layoutGraph(nodes: GraphNodeMap): LayoutPositions {
  const roots = Object.values(nodes).filter((node) => !primaryParentOf(nodes, node.id) || !nodes[primaryParentOf(nodes, node.id) as string])
  const positions: LayoutPositions = {}
  let top = 0
  roots.forEach((root) => {
    placeTree(nodes, root.id, 0, top, positions)
    top += measureHeights(nodes, root.id) + GAP_TRACK
  })
  return positions
}

export interface DeterministicNodePosition {
  x: number
  y: number
  width: number
  height: number
  left: number
  right: number
  centerY: number
  level: number
  order: number
}

/**
 * Calculates strict, deterministic coordinates for every node in the Task Tree / DAG.
 * Guarantees zero NaN values and safe fallback math:
 * - Level 0 (Root): X = 40
 * - Level 1 (Track): X = 320
 * - Level 2 (Task): X = 640
 * - Y is computed deterministically from track index and task sequence.
 */
export function calculateDeterministicLayout(
  nodes: GraphNodeMap
): Record<string, DeterministicNodePosition> {
  const result: Record<string, DeterministicNodePosition> = {}

  const root =
    Object.values(nodes).find((n) => n.kind === 'root') || {
      id: 'root',
      kind: 'root' as const,
      title: 'Root',
      parentIds: [],
    }

  const tracks = Object.values(nodes)
    .filter(
      (n): n is BranchGraphNode =>
        n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack)
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let currentY = 40

  tracks.forEach((track, trackIdx) => {
    const trackWidth = W.track
    const trackHeight = TRACK_H
    const trackX = 320
    const trackY = currentY

    const safeTrackX = Number.isFinite(track.x) ? track.x! : trackX
    const safeTrackY = Number.isFinite(track.y) ? track.y! : trackY

    result[track.id] = {
      x: safeTrackX,
      y: safeTrackY,
      width: trackWidth,
      height: trackHeight,
      left: safeTrackX,
      right: safeTrackX + trackWidth,
      centerY: safeTrackY + trackHeight / 2,
      level: 1,
      order: trackIdx,
    }

    // Direct tasks under this track or subtasks
    const tasksInTrack = Object.values(nodes)
      .filter(
        (n): n is BranchGraphNode =>
          n.kind === 'branch' &&
          !(n as BranchGraphNode).isTrack &&
          (n.parentIds.includes(track.id) ||
            (n as BranchGraphNode).trackId === track.id)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    let taskY = trackY
    tasksInTrack.forEach((task, taskIdx) => {
      const taskLevel = task.level ?? 2
      const computedX = 640 + Math.max(0, taskLevel - 2) * (W.task + GAP_X)
      const taskWidth = W.task
      const taskHeight = TASK_H

      const safeX = Number.isFinite(task.x) ? task.x! : computedX
      const safeY = Number.isFinite(task.y) ? task.y! : taskY

      result[task.id] = {
        x: safeX,
        y: safeY,
        width: taskWidth,
        height: taskHeight,
        left: safeX,
        right: safeX + taskWidth,
        centerY: safeY + taskHeight / 2,
        level: taskLevel,
        order: taskIdx,
      }

      taskY += taskHeight + 14
    })

    const blockHeight = Math.max(trackHeight, taskY - trackY)
    currentY += blockHeight + 24
  })

  // Center Root relative to tracks
  const rootWidth = W.root
  const rootHeight = ROOT_H
  const rootX = 40
  const computedRootY =
    tracks.length > 0 ? (40 + currentY - 24 - rootHeight) / 2 : 40
  const safeRootY = Number.isFinite(root.y) ? root.y! : Math.max(40, computedRootY)

  result[root.id] = {
    x: rootX,
    y: safeRootY,
    width: rootWidth,
    height: rootHeight,
    left: rootX,
    right: rootX + rootWidth,
    centerY: safeRootY + rootHeight / 2,
    level: 0,
    order: 0,
  }

  // Any remaining orphan or ghost nodes
  Object.values(nodes).forEach((n) => {
    if (!result[n.id]) {
      const branch = n as BranchGraphNode
      const level = branch.level ?? (n.kind === 'ghost' ? 0 : 2)
      const defaultX = level === 0 ? 40 : level === 1 ? 320 : 640
      const width =
        n.kind === 'root'
          ? W.root
          : branch.isTrack
          ? W.track
          : W.task
      const height =
        n.kind === 'root' ? ROOT_H : branch.isTrack ? TRACK_H : TASK_H

      const safeX = Number.isFinite(branch.x) ? branch.x! : defaultX
      const safeY = Number.isFinite(branch.y) ? branch.y! : currentY

      result[n.id] = {
        x: safeX,
        y: safeY,
        width,
        height,
        left: safeX,
        right: safeX + width,
        centerY: safeY + height / 2,
        level,
        order: 0,
      }
      currentY += height + 16
    }
  })

  return result
}

/**
 * Creates a new BranchGraphNode with complete hierarchy data contracts
 * (trackId, parentId, level, order, column, row, phaseId, code, title).
 */
export function createNewBranchNode(
  source: GraphNode | null | undefined,
  nodes: GraphNodeMap,
  phaseId = '',
  customTitle?: string
): BranchGraphNode {
  const isAddingTrack = !source || source.kind === 'root'

  if (isAddingTrack) {
    const existingTracks = Object.values(nodes).filter(
      (n): n is BranchGraphNode => n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack)
    )
    const trackOrder = existingTracks.length
    const id = `track-${Date.now()}`
    const code = `TRK-${String(trackOrder + 1).padStart(2, '0')}`
    const title = customTitle || `Track ${trackOrder + 1}: Nhánh công việc mới`

    return {
      kind: 'branch',
      id,
      code,
      title,
      phaseId,
      trackId: id,
      parentId: 'root',
      parentIds: ['root'],
      status: 'TODO',
      description: '',
      isTrack: true,
      assignee: null,
      due: null,
      blocker: null,
      joinPolicy: null,
      level: 1,
      order: trackOrder,
      column: 1,
      row: trackOrder,
    }
  }

  const sourceBranch = source as BranchGraphNode
  const isSourceTrack = source.kind === 'branch' && sourceBranch.isTrack
  const resolvedTrackId = isSourceTrack
    ? source.id
    : sourceBranch.trackId || sourceBranch.parentIds[0] || source.id

  const siblings = Object.values(nodes).filter((n) =>
    n.parentIds.includes(source.id)
  )
  const taskOrder = siblings.length
  const targetLevel = (sourceBranch.level ?? (isSourceTrack ? 1 : 2)) + 1
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const code = `WPE-${Math.floor(100 + Math.random() * 900)}`
  const title = customTitle || `New Task Node ${taskOrder + 1}`

  return {
    kind: 'branch',
    id,
    code,
    title,
    phaseId: phaseId || sourceBranch.phaseId || '',
    trackId: resolvedTrackId,
    parentId: source.id,
    parentIds: [source.id],
    status:
      source.kind === 'branch' && sourceBranch.status === 'DONE'
        ? 'TODO'
        : 'LOCKED',
    description: '',
    isTrack: false,
    assignee: null,
    due: null,
    blocker:
      source.kind === 'branch' && sourceBranch.status !== 'DONE'
        ? `Chờ ${sourceBranch.title || source.id} hoàn tất`
        : null,
    joinPolicy: null,
    level: targetLevel,
    order: taskOrder,
    column: targetLevel,
    row: taskOrder,
  }
}

