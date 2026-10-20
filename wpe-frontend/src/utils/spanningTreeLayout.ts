import type { BranchGraphNode, GhostGraphNode, GraphNode, GraphNodeMap, MacroPhase, RootGraphNode } from '../types/workflow.types'

export const CARD_DIMENSIONS = {
  TASK_WIDTH: 240,
  TASK_HEIGHT: 84,
  TRACK_WIDTH: 200,
  TRACK_HEIGHT: 64,
  ROOT_WIDTH: 180,
  ROOT_HEIGHT: 60,
  GHOST_WIDTH: 240,
  GHOST_HEIGHT: 110,
  GAP_Y: 16,         // Khoảng cách theo trục Y giữa 2 card lá kề nhau
  TRACK_SPACING: 48, // Khoảng cách bổ sung giữa 2 cụm track của Root
  LEVEL_STEP_X: 280, // Khoảng cách cột X theo từng cấp level (Ví dụ: 40, 320, 600, 880, 1160...)
  START_X: 40,
  START_Y: 60,
} as const

export function getLevelX(level: number): number {
  return CARD_DIMENSIONS.START_X + level * CARD_DIMENSIONS.LEVEL_STEP_X
}

export const COL_W = 250
export const GAP_X = 80
export const GAP_TRACK = 18
export const GAP = 10
export const ROOT_H = CARD_DIMENSIONS.ROOT_HEIGHT
export const TRACK_H = CARD_DIMENSIONS.TRACK_HEIGHT
export const TASK_H = CARD_DIMENSIONS.TASK_HEIGHT
export const GHOST_H = CARD_DIMENSIONS.GHOST_HEIGHT
export const W = {
  track: CARD_DIMENSIONS.TRACK_WIDTH,
  task: CARD_DIMENSIONS.TASK_WIDTH,
  root: CARD_DIMENSIONS.ROOT_WIDTH,
  ghost: CARD_DIMENSIONS.GHOST_WIDTH,
} as const

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
 * Resolves the parent track ID for any task node in the graph using BFS ancestor search.
 */
export function resolveTrackIdForNode(
  node: GraphNode | null | undefined,
  allNodes: GraphNodeMap
): string | null {
  if (!node || node.kind !== 'branch') return null
  if (node.isTrack) return node.id
  if (
    node.trackId &&
    allNodes[node.trackId] &&
    (allNodes[node.trackId] as BranchGraphNode).isTrack
  ) {
    return node.trackId
  }

  // BFS search up the parentIds tree to find the nearest Track
  const queue = [...node.parentIds]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (!currentId || visited.has(currentId) || currentId === 'root') continue
    visited.add(currentId)

    const parent = allNodes[currentId]
    if (!parent) continue
    if (parent.kind === 'branch') {
      if (parent.isTrack) return parent.id
      if (
        parent.trackId &&
        allNodes[parent.trackId] &&
        (allNodes[parent.trackId] as BranchGraphNode).isTrack
      ) {
        return parent.trackId
      }
      for (const grandParentId of parent.parentIds) {
        if (!visited.has(grandParentId)) queue.push(grandParentId)
      }
    }
  }

  // Fallback: match by trackId directly if present in allNodes
  if (node.trackId && allNodes[node.trackId]) return node.trackId

  // Fallback: return the first track in allNodes
  const allTracks = Object.values(allNodes).filter(
    (n): n is BranchGraphNode =>
      n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack)
  )
  if (allTracks.length > 0) {
    return allTracks[0].id
  }

  return null
}

export interface GraphLayoutNode extends DeterministicNodePosition {
  id: string
  type: 'root' | 'track' | 'task' | 'ghost'
  trackId?: string
}

export interface GraphLayoutEdge {
  id: string
  sourceId: string
  targetId: string
  d: string
  direct: boolean
  isGhost: boolean
}

/**
 * Recursive Tidy Tree / Subtree graph layout engine.
 * Single Source of Truth (SSOT) for Phase Mindmap & DAG Tree Layout.
 * Dynamic Level-based X:
 *   X = START_X + level * LEVEL_STEP_X (40, 320, 600, 880, 1160...)
 * Recursive Subtree Height & Accumulator Spacing:
 *   - Leaf: CARD_HEIGHT + GAP_Y
 *   - Parent: sum(subtreeHeight(children))
 *   - Subsequent subtrees start strictly after preceding subtrees complete
 *   - Parent centered on its children: centerY = (centerY_first + centerY_last) / 2
 */
export function calculatePhaseGraphLayout(
  nodes: GraphNodeMap,
  collapsed = new Set<string>()
): {
  layoutNodes: GraphLayoutNode[]
  layoutEdges: GraphLayoutEdge[]
} {
  const nodeList = Object.values(nodes)
  if (nodeList.length === 0) {
    return { layoutNodes: [], layoutEdges: [] }
  }

  // 1. Identify or synthesize root node
  const rootNode = nodeList.find((n) => n.kind === 'root') || {
    id: 'root',
    kind: 'root' as const,
    parentIds: [],
    title: 'Phase Root',
  }

  // 2. Build multi-level spanning tree hierarchy
  const parentMap: Record<string, string> = {}
  const childrenMap: Record<string, GraphNode[]> = {}

  // Direct track nodes under root
  const tracks = nodeList
    .filter((n): n is BranchGraphNode => n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  tracks.forEach((track) => {
    parentMap[track.id] = rootNode.id
    if (!childrenMap[rootNode.id]) childrenMap[rootNode.id] = []
    childrenMap[rootNode.id].push(track)
  })

  // Non-track branch nodes (exclude ghost nodes from tree hierarchy)
  const branchTasks = nodeList.filter(
    (n): n is BranchGraphNode =>
      n.kind === 'branch' && !Boolean((n as BranchGraphNode).isTrack)
  )

  branchTasks.forEach((node) => {
    let parentId: string | null = null
    const candParent = node.parentId || node.parentIds[0]

    if (candParent && candParent !== node.id && nodes[candParent]) {
      if (!isAncestor(nodes, node.id, candParent)) {
        parentId = candParent
      }
    }

    if (!parentId) {
      const trackId = resolveTrackIdForNode(node, nodes)
      if (trackId && nodes[trackId] && trackId !== node.id) {
        parentId = trackId
      } else if (tracks.length > 0) {
        parentId = tracks[0].id
      } else {
        parentId = rootNode.id
      }
    }

    parentMap[node.id] = parentId
    if (!childrenMap[parentId]) childrenMap[parentId] = []
    childrenMap[parentId].push(node)
  })

  // Sort children by order (tie-break by id)
  Object.keys(childrenMap).forEach((pId) => {
    childrenMap[pId].sort((a, b) => {
      const orderA = (a as BranchGraphNode).order ?? 0
      const orderB = (b as BranchGraphNode).order ?? 0
      if (orderA !== orderB) return orderA - orderB
      return a.id.localeCompare(b.id)
    })
  })

  const getVisualWidth = (node: GraphNode): number => {
    if (node.width) return node.width
    if (node.kind === 'root') return CARD_DIMENSIONS.ROOT_WIDTH
    if (node.kind === 'branch' && node.isTrack) return CARD_DIMENSIONS.TRACK_WIDTH
    if (node.kind === 'ghost') return CARD_DIMENSIONS.GHOST_WIDTH
    return CARD_DIMENSIONS.TASK_WIDTH
  }

  const getVisualHeight = (node: GraphNode): number => {
    if (node.height) return node.height
    if (node.kind === 'root') return CARD_DIMENSIONS.ROOT_HEIGHT
    if (node.kind === 'branch' && node.isTrack) return CARD_DIMENSIONS.TRACK_HEIGHT
    if (node.kind === 'ghost') return CARD_DIMENSIONS.GHOST_HEIGHT
    return CARD_DIMENSIONS.TASK_HEIGHT
  }

  // 3. Pass 1: Recursive Subtree Height Calculation
  const subtreeHeightMemo = new Map<string, number>()

  const measureSubtreeHeight = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)

    if (subtreeHeightMemo.has(nodeId)) {
      return subtreeHeightMemo.get(nodeId)!
    }

    const node = nodes[nodeId] || (nodeId === rootNode.id ? rootNode : null)
    if (!node) return 0

    const visualH = getVisualHeight(node)
    const leafHeight = visualH + CARD_DIMENSIONS.GAP_Y

    if (collapsed.has(nodeId)) {
      subtreeHeightMemo.set(nodeId, leafHeight)
      return leafHeight
    }

    const children = childrenMap[nodeId] || []
    if (children.length === 0) {
      subtreeHeightMemo.set(nodeId, leafHeight)
      return leafHeight
    }

    // height(node) = sum_{child in children} height(child)
    let sumChildren = 0
    for (const child of children) {
      sumChildren += measureSubtreeHeight(child.id, new Set(visited))
    }

    if (node.kind === 'root' && children.length > 1) {
      sumChildren += (children.length - 1) * CARD_DIMENSIONS.TRACK_SPACING
    }

    const result = Math.max(leafHeight, sumChildren)
    subtreeHeightMemo.set(nodeId, result)
    return result
  }

  // Measure from root
  measureSubtreeHeight(rootNode.id)

  // 4. Pass 2: Recursive Subtree Layout & Y-Accumulator
  const layoutNodes: GraphLayoutNode[] = []
  const nodePosMap: Record<string, GraphLayoutNode> = {}
  const layoutEdges: GraphLayoutEdge[] = []
  const placedIds = new Set<string>()

  const layoutSubtree = (
    nodeId: string,
    level: number,
    x: number,
    topY: number
  ): { centerY: number; y: number; height: number } => {
    const node = nodes[nodeId] || (nodeId === rootNode.id ? rootNode : null)
    if (!node) {
      return { centerY: topY, y: topY, height: 0 }
    }

    placedIds.add(nodeId)
    const visualW = getVisualWidth(node)
    const visualH = getVisualHeight(node)
    const children = collapsed.has(nodeId) ? [] : (childrenMap[nodeId] || [])
    const isRoot = node.kind === 'root'

    let calculatedCenterY = topY + visualH / 2
    let calculatedY = topY

    if (children.length === 0) {
      // Leaf node: placed at topY
      calculatedY = topY
      calculatedCenterY = topY + visualH / 2
    } else {
      // Parent node: layout all child subtrees recursively with accumulator
      let childY = topY
      const childCenterYs: number[] = []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const childSubtreeH = measureSubtreeHeight(child.id)
        const childLevel = level + 1
        const childX = CARD_DIMENSIONS.START_X + childLevel * CARD_DIMENSIONS.LEVEL_STEP_X

        const childRes = layoutSubtree(child.id, childLevel, childX, childY)
        childCenterYs.push(childRes.centerY)

        // Dồn dòng Y tất định (Accumulator Spacing):
        // Nhánh sau luôn bắt đầu tại tọa độ Y sau khi nhánh trước đã kết thúc trọn vẹn
        childY += childSubtreeH
        if (isRoot && i < children.length - 1) {
          childY += CARD_DIMENSIONS.TRACK_SPACING
        }
      }

      // Node cha luôn được căn giữa theo khối các node con của nó:
      // Y_parent = (Y_first_child + Y_last_child) / 2
      const firstCenterY = childCenterYs[0]
      const lastCenterY = childCenterYs[childCenterYs.length - 1]
      calculatedCenterY = (firstCenterY + lastCenterY) / 2
      calculatedY = calculatedCenterY - visualH / 2
    }

    const layoutNode: GraphLayoutNode = {
      ...node,
      id: node.id,
      x,
      y: calculatedY,
      width: visualW,
      height: visualH,
      left: x,
      right: x + visualW,
      centerY: calculatedCenterY,
      level,
      order: (node as BranchGraphNode).order ?? 0,
      type:
        node.kind === 'root'
          ? 'root'
          : (node as BranchGraphNode).isTrack
          ? 'track'
          : node.kind === 'ghost'
          ? 'ghost'
          : 'task',
      trackId:
        (node as BranchGraphNode).trackId ||
        resolveTrackIdForNode(node, nodes) ||
        undefined,
    }

    layoutNodes.push(layoutNode)
    nodePosMap[node.id] = layoutNode

    return { centerY: calculatedCenterY, y: calculatedY, height: visualH }
  }

  // Execute recursive layout starting at root (Level 0: X = 40, Y = 60)
  layoutSubtree(rootNode.id, 0, CARD_DIMENSIONS.START_X, CARD_DIMENSIONS.START_Y)

  // 5. Generate primary SVG Bézier edges for spanning tree (from parent right to child left)
  placedIds.forEach((childId) => {
    if (childId === rootNode.id) return
    const parentId = parentMap[childId]
    if (!parentId) return

    const parentPos = nodePosMap[parentId]
    const childPos = nodePosMap[childId]
    if (!parentPos || !childPos) return

    const startX = parentPos.right
    const startY = parentPos.centerY
    const endX = childPos.left
    const endY = childPos.centerY
    const midX = (startX + endX) / 2
    const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`

    layoutEdges.push({
      id: `edge-${parentId}-${childId}`,
      sourceId: parentId,
      targetId: childId,
      d,
      direct: true,
      isGhost: false,
    })
  })

  // 6. Anchor Ghost Nodes strictly to the RIGHT of their dependent target task
  // Rule: Ghost nodes are external prerequisites anchored to the right of the task they guard.
  // Floating or unanchored ghost nodes are discarded.
  const ghostNodes = nodeList.filter(
    (n): n is GhostGraphNode => n.kind === 'ghost'
  )

  const ghostsByTarget: Record<string, GhostGraphNode[]> = {}

  ghostNodes.forEach((ghost) => {
    let targetTaskId = ghost.targetTaskId
    if (!targetTaskId) {
      // Find candidate target from parentIds pointing to a branch task
      targetTaskId = ghost.parentIds.find(
        (p) => p !== 'root' && nodePosMap[p] && nodes[p]?.kind === 'branch'
      )
    }
    if (!targetTaskId) {
      // Find candidate target from any branch task that has this ghost in its parentIds
      targetTaskId = Object.values(nodes).find(
        (n) => n.kind === 'branch' && n.parentIds.includes(ghost.id)
      )?.id
    }

    if (targetTaskId && nodePosMap[targetTaskId]) {
      if (!ghostsByTarget[targetTaskId]) {
        ghostsByTarget[targetTaskId] = []
      }
      ghostsByTarget[targetTaskId].push(ghost)
    }
  })

  const GHOST_OFFSET_X = 60
  const GHOST_GAP_Y = 12

  Object.entries(ghostsByTarget).forEach(([targetTaskId, attachedGhosts]) => {
    const targetPos = nodePosMap[targetTaskId]
    if (!targetPos) return

    const count = attachedGhosts.length
    const ghostH = CARD_DIMENSIONS.GHOST_HEIGHT
    const ghostW = CARD_DIMENSIONS.GHOST_WIDTH
    const totalH = count * ghostH + (count - 1) * GHOST_GAP_Y
    const startY = targetPos.centerY - totalH / 2

    attachedGhosts.forEach((ghost, idx) => {
      const ghostX = targetPos.right + GHOST_OFFSET_X
      const ghostY = startY + idx * (ghostH + GHOST_GAP_Y)
      const centerY = ghostY + ghostH / 2

      const ghostLayoutNode: GraphLayoutNode = {
        ...ghost,
        id: ghost.id,
        x: ghostX,
        y: ghostY,
        width: ghostW,
        height: ghostH,
        left: ghostX,
        right: ghostX + ghostW,
        centerY,
        level: targetPos.level + 1,
        order: idx,
        type: 'ghost',
        trackId: targetPos.trackId,
      }

      layoutNodes.push(ghostLayoutNode)
      nodePosMap[ghost.id] = ghostLayoutNode
      placedIds.add(ghost.id)

      // Cubic Bezier curve connecting target task right to ghost node left:
      // M (targetX) (targetY) C (targetX + 50) (targetY), (ghostX - 50) (ghostY), (ghostX) (ghostY)
      const targetX = targetPos.right
      const targetY = targetPos.centerY
      const gX = ghostLayoutNode.left
      const gY = ghostLayoutNode.centerY
      const d = `M ${targetX} ${targetY} C ${targetX + 50} ${targetY}, ${gX - 50} ${gY}, ${gX} ${gY}`

      layoutEdges.push({
        id: `ghost-edge-${targetTaskId}-${ghost.id}`,
        sourceId: targetTaskId,
        targetId: ghost.id,
        d,
        direct: false,
        isGhost: true,
      })
    })
  })

  // 7. Add secondary prerequisite edges between branch tasks (AND-Join, cross-track)
  nodeList.forEach((n) => {
    if (n.kind !== 'branch') return
    const childPos = nodePosMap[n.id]
    if (!childPos) return

    const primaryParent = parentMap[n.id]

    n.parentIds.forEach((pId) => {
      if (pId === primaryParent || pId === 'root') return
      // Skip ghost parents since they are connected by right-anchored ghost edges
      if (nodes[pId]?.kind === 'ghost') return
      const parentPos = nodePosMap[pId]
      if (!parentPos) return

      const startX = parentPos.right
      const startY = parentPos.centerY
      const endX = childPos.left
      const endY = childPos.centerY

      let d = ''
      if (startX >= endX) {
        const loopX = startX + 40
        d = `M ${startX} ${startY} C ${loopX} ${startY}, ${loopX} ${endY}, ${endX} ${endY}`
      } else {
        const midX = (startX + endX) / 2
        d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
      }

      layoutEdges.push({
        id: `edge-${pId}-${n.id}`,
        sourceId: pId,
        targetId: n.id,
        d,
        direct: false,
        isGhost: false,
      })
    })
  })

  // 8. Safety fallback: Place any unplaced / disconnected branch nodes only
  // (Loose, unanchored ghost nodes are explicitly discarded per specification)
  let fallbackY = Math.max(
    ...layoutNodes.map((n) => n.y + n.height),
    CARD_DIMENSIONS.START_Y
  ) + CARD_DIMENSIONS.GAP_Y

  nodeList.forEach((n) => {
    if (n.kind === 'ghost') return // Exclude unanchored ghost nodes from fallback
    if (!nodePosMap[n.id]) {
      const visualW = getVisualWidth(n)
      const visualH = getVisualHeight(n)
      const level = (n as BranchGraphNode).level ?? 2
      const x = CARD_DIMENSIONS.START_X + level * CARD_DIMENSIONS.LEVEL_STEP_X

      const fallbackNode: GraphLayoutNode = {
        ...n,
        id: n.id,
        x,
        y: fallbackY,
        width: visualW,
        height: visualH,
        left: x,
        right: x + visualW,
        centerY: fallbackY + visualH / 2,
        level,
        order: (n as BranchGraphNode).order ?? 0,
        type:
          n.kind === 'root'
            ? 'root'
            : (n as BranchGraphNode).isTrack
            ? 'track'
            : 'task',
        trackId:
          (n as BranchGraphNode).trackId ||
          resolveTrackIdForNode(n, nodes) ||
          undefined,
      }
      layoutNodes.push(fallbackNode)
      nodePosMap[n.id] = fallbackNode
      fallbackY += visualH + CARD_DIMENSIONS.GAP_Y
    }
  })

  return { layoutNodes, layoutEdges }
}

/**
 * Calculates strict, deterministic coordinates for every node in the Phase Graph.
 * Delegates to calculatePhaseGraphLayout as the Single Source of Truth (SSOT).
 */
export function calculateDeterministicLayout(
  nodes: GraphNodeMap,
  collapsed = new Set<string>()
): Record<string, DeterministicNodePosition> {
  const { layoutNodes } = calculatePhaseGraphLayout(nodes, collapsed)
  const result: Record<string, DeterministicNodePosition> = {}
  layoutNodes.forEach((node) => {
    result[node.id] = node
  })
  return result
}

/**
 * Creates a new BranchGraphNode with complete hierarchy data contracts
 * (trackId, parentId, level, order, column, row, phaseId, code, title, width, height).
 * Supports arbitrary multi-level tree expansion:
 * - Adding to Root: creates Track (level 1)
 * - Adding to Track: creates Task (level 2)
 * - Adding to Task: creates Subtask (level 3)
 * - Adding to Subtask: creates Child Subtask (level 4, 5, ... infinite)
 */
export function createNewBranchNode(
  source: GraphNode | null | undefined,
  nodes: GraphNodeMap,
  phaseId = '',
  customTitle?: string,
  customOrder?: number
): BranchGraphNode {
  const isAddingTrack = !source || source.kind === 'root'

  if (isAddingTrack) {
    const existingTracks = Object.values(nodes).filter(
      (n): n is BranchGraphNode => n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack)
    )
    const trackOrder = customOrder !== undefined ? customOrder : existingTracks.length
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
      width: CARD_DIMENSIONS.TRACK_WIDTH,
      height: CARD_DIMENSIONS.TRACK_HEIGHT,
    }
  }

  // Adding child to a Track OR to an existing Task/Subtask (Multi-level Tree Expansion)
  const sourceBranch = source as BranchGraphNode
  const isSourceTrack = source.kind === 'branch' && Boolean(sourceBranch.isTrack)

  // Target parent is ALWAYS source.id
  const parentId = source.id
  const parentIds = [source.id]

  // Track ID is inherited from ancestor track
  const targetTrackId = isSourceTrack
    ? source.id
    : sourceBranch.trackId || resolveTrackIdForNode(source, nodes) || source.id

  // Depth level is parent.level + 1
  const parentLevel = sourceBranch.level ?? (isSourceTrack ? 1 : 2)
  const childLevel = parentLevel + 1

  // Count existing direct children under source.id to determine order
  const existingChildren = Object.values(nodes).filter(
    (n) => n.parentIds.includes(parentId) || (n as BranchGraphNode).parentId === parentId
  )
  const taskOrder = customOrder !== undefined ? customOrder : existingChildren.length

  const allTasksCount = Object.values(nodes).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  ).length

  const targetTrackNode = nodes[targetTrackId] as BranchGraphNode | undefined
  const trackNumMatch = targetTrackNode?.title.match(/Track\s*(\d+)/i)
  const trackNum = trackNumMatch ? trackNumMatch[1] : ''

  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const code = `WPE-${Math.floor(100 + Math.random() * 900)}`

  let title = customTitle
  if (!title) {
    if (isSourceTrack) {
      title = trackNum
        ? `Task ${taskOrder + 1} (Track ${trackNum})`
        : `New Task Node ${allTasksCount + 1}`
    } else {
      title = `Subtask ${taskOrder + 1}`
    }
  }

  return {
    kind: 'branch',
    id,
    code,
    title,
    phaseId: phaseId || sourceBranch.phaseId || '',
    trackId: targetTrackId,
    parentId,
    parentIds,
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
    level: childLevel,
    order: taskOrder,
    column: childLevel,
    row: taskOrder,
    width: CARD_DIMENSIONS.TASK_WIDTH,
    height: CARD_DIMENSIONS.TASK_HEIGHT,
  }
}

