import type { GraphNode, GraphNodeMap, MacroPhase } from '../types/workflow.types'

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
