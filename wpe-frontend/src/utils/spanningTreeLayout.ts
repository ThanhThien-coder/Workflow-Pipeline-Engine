import type { BranchGraphNode, GhostGraphNode, GraphNode, GraphNodeMap, MacroPhase, RootGraphNode } from '../types/workflow.types'

export const CARD_DIMENSIONS = {
  TASK_WIDTH: 240,
  TASK_HEIGHT: 84,
  TRACK_WIDTH: 200,
  TRACK_HEIGHT: 64,
  ROOT_WIDTH: 180,
  ROOT_HEIGHT: 60,
  GHOST_WIDTH: 240,
  GHOST_HEIGHT: 126,
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

/**
 * Node `id` (tính cả chính nó) có tổ tiên là ghost không, tức có phụ thuộc đi vào từ phase khác.
 * Không có thì một cạnh mới vào node này không thể tạo vòng đi qua phase khác (vòng trong phase đã có isAncestor chặn).
 */
export function hasGhostAncestor(nodes: GraphNodeMap, id: string): boolean {
  const queue = [id]
  const seen = new Set(queue)
  while (queue.length) {
    const node = nodes[queue.shift() as string]
    if (!node) continue
    if (node.kind === 'ghost') return true
    node.parentIds.forEach((parent) => {
      if (!seen.has(parent)) {
        seen.add(parent)
        queue.push(parent)
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
  if (!next[id] || next[id].kind === 'root') return nodes

  // 1. Specialized handling for Ghost Nodes (external prerequisites)
  // Removing a ghost node removes only the ghost node and unblocks the target task
  if (next[id].kind === 'ghost') {
    delete next[id]
    Object.keys(next).forEach((nodeId) => {
      const node = next[nodeId]
      if (node.parentIds && node.parentIds.includes(id)) {
        const nextParentIds = node.parentIds.filter((p) => p !== id)
        const updated: GraphNode = {
          ...node,
          parentIds: nextParentIds,
        }
        if (updated.kind === 'branch' && updated.status === 'LOCKED') {
          // If task was locked and no other unfinished ghost prerequisite guards it, unlock to TODO
          const otherGhosts = Object.values(next).filter(
            (g): g is Extract<GraphNodeMap[string], { kind: 'ghost' }> =>
              g.kind === 'ghost' && (g.targetTaskId === nodeId || nextParentIds.includes(g.id))
          )
          const stillBlocked = otherGhosts.some((g) => g.status !== 'DONE')
          if (!stillBlocked) {
            updated.status = 'TODO'
            updated.blocker = null
          }
        }
        next[nodeId] = updated
      }
    })
    return next
  }

  // 2. Cascade deletion for tree branches (Root nodes of any ID are strictly protected)
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
      // Must check kind !== 'root' so custom root nodes (e.g. root_PH_...) are never removed!
      if (next[nodeId].kind !== 'root' && !removed.has(nodeId) && next[nodeId].parentIds.length === 0) {
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
  /** Dây là một phụ thuộc thật (task → task, ghost → task): gỡ được bằng removeDependency. Dây cấu trúc (track) thì không. */
  isDependency: boolean
  /** Điểm giữa của dây (t = 0.5): nơi đặt nút gỡ dây. */
  midX: number
  midY: number
}

/** Điểm giữa (t = 0.5) của đường cong Bézier bậc 3. */
function bezierMid(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
  return { midX: (x0 + 3 * x1 + 3 * x2 + x3) / 8, midY: (y0 + 3 * y1 + 3 * y2 + y3) / 8 }
}

/** Khoảng cách dọc giữa 2 ghost cùng một task đích. */
const GHOST_GAP_Y = 12

/**
 * Recursive Tidy Tree / Subtree graph layout engine.
 * Single Source of Truth (SSOT) for Phase Mindmap & DAG Tree Layout.
 *
 * - Root ảo (`root_<phaseId>`) chỉ để neo bố cục: KHÔNG có trong layoutNodes và KHÔNG có dây đi ra từ nó.
 *   Các node không có cha trong phase là cột đầu tiên (level 0, X = START_X).
 * - Dynamic Level-based X: X = START_X + level * LEVEL_STEP_X (40, 320, 600, 880, ...)
 * - Ghost là CHA của task đích nên đứng BÊN TRÁI nó, trong một cột riêng ngay trước task (level - 1).
 *   Phase có ghost: cột 0 chừa cho ghost, mọi task gốc ở cột 1 (x = START_X + LEVEL_STEP_X) nên thẳng hàng
 *   dù có ghost hay không. Task con (không phải gốc) có ghost vẫn được đẩy sang phải 1 cột để ghost không
 *   đè lên cha thật; ghost nằm gọn trong khối dọc của task đích nên không đè thẻ khác. Dây đi ghost → task.
 * - Recursive Subtree Height & Accumulator Spacing; cha căn giữa theo khối con.
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

  // 1. Identify or synthesize root node (chỉ dùng để neo, không vẽ)
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
    // Cha chính: cha đầu tiên là node thật (không phải ghost), không tạo vòng
    const candidates = [node.parentId, ...node.parentIds]
    for (const cand of candidates) {
      if (!cand || cand === node.id || !nodes[cand] || nodes[cand].kind === 'ghost') continue
      if (isAncestor(nodes, node.id, cand)) continue
      parentId = cand
      break
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

  // 3. Pre-index Ghost Nodes by target task to allocate layout space and prevent collisions
  const ghostNodes = nodeList.filter(
    (n): n is GhostGraphNode => n.kind === 'ghost'
  )

  const ghostsByTarget: Record<string, GhostGraphNode[]> = {}

  ghostNodes.forEach((ghost) => {
    let targetTaskId = ghost.targetTaskId
    if (!targetTaskId) {
      targetTaskId = ghost.parentIds.find(
        (p) => p !== 'root' && nodes[p]?.kind === 'branch'
      )
    }
    if (!targetTaskId) {
      targetTaskId = Object.values(nodes).find(
        (n) => n.kind === 'branch' && n.parentIds.includes(ghost.id)
      )?.id
    }

    if (targetTaskId && nodes[targetTaskId]) {
      if (!ghostsByTarget[targetTaskId]) {
        ghostsByTarget[targetTaskId] = []
      }
      ghostsByTarget[targetTaskId].push(ghost)
    }
  })

  const ghostClusterHeight = (taskId: string): number => {
    const count = (ghostsByTarget[taskId] || []).length
    return count > 0 ? count * CARD_DIMENSIONS.GHOST_HEIGHT + (count - 1) * GHOST_GAP_Y : 0
  }

  /** Khoảng cách thêm giữa 2 con liền nhau: chỉ các track (nhóm lớn) mới cần thở rộng hơn. */
  const siblingExtra = (a: GraphNode, b: GraphNode): number =>
    (a as BranchGraphNode).isTrack && (b as BranchGraphNode).isTrack ? CARD_DIMENSIONS.TRACK_SPACING : 0

  const visibleChildren = (nodeId: string): GraphNode[] =>
    collapsed.has(nodeId) ? [] : childrenMap[nodeId] || []

  // 4. Pass 1: Recursive Subtree Height Calculation
  const subtreeHeightMemo = new Map<string, number>()

  const childrenBlockHeight = (nodeId: string, visited: Set<string>): number => {
    const children = visibleChildren(nodeId)
    let sum = 0
    children.forEach((child, i) => {
      sum += measureSubtreeHeight(child.id, new Set(visited))
      if (i > 0) sum += siblingExtra(children[i - 1], child)
    })
    return sum
  }

  const measureSubtreeHeight = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)

    if (subtreeHeightMemo.has(nodeId)) {
      return subtreeHeightMemo.get(nodeId)!
    }

    const node = nodes[nodeId] || (nodeId === rootNode.id ? rootNode : null)
    if (!node) return 0

    // Khối dọc của node = lớn nhất của: thẻ + khe, cụm ghost bên trái, và khối các con
    const ownH = getVisualHeight(node) + CARD_DIMENSIONS.GAP_Y
    const ghostH = ghostClusterHeight(nodeId)
    const ghostBlockH = ghostH > 0 ? ghostH + CARD_DIMENSIONS.GAP_Y : 0
    const result = Math.max(ownH, ghostBlockH, childrenBlockHeight(nodeId, visited))
    subtreeHeightMemo.set(nodeId, result)
    return result
  }

  // Measure from root
  measureSubtreeHeight(rootNode.id)

  // 5. Pass 2: Recursive Subtree Layout & Y-Accumulator
  const layoutNodes: GraphLayoutNode[] = []
  const nodePosMap: Record<string, GraphLayoutNode> = {}
  const blockTopMap: Record<string, number> = {}
  const layoutEdges: GraphLayoutEdge[] = []
  const placedIds = new Set<string>()

  const columnX = (level: number): number => CARD_DIMENSIONS.START_X + level * CARD_DIMENSIONS.LEVEL_STEP_X

  const layoutSubtree = (
    nodeId: string,
    level: number,
    topY: number
  ): { centerY: number; y: number; height: number } => {
    const node = nodes[nodeId] || (nodeId === rootNode.id ? rootNode : null)
    if (!node) {
      return { centerY: topY, y: topY, height: 0 }
    }

    placedIds.add(nodeId)
    blockTopMap[nodeId] = topY
    const x = columnX(level)
    const visualW = getVisualWidth(node)
    const visualH = getVisualHeight(node)
    const children = visibleChildren(nodeId)

    let calculatedCenterY = topY + visualH / 2
    let calculatedY = topY

    if (children.length > 0) {
      // Các con nằm giữa khối dọc của node (khối có thể cao hơn vì cụm ghost bên trái)
      const blockH = measureSubtreeHeight(nodeId)
      const childrenH = childrenBlockHeight(nodeId, new Set([nodeId]))
      let childY = topY + Math.max(0, (blockH - childrenH) / 2)
      const childCenterYs: number[] = []

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const childSubtreeH = measureSubtreeHeight(child.id)
        // Task có ghost cần thêm 1 cột phía trước cho cụm ghost
        const childLevel = level + 1 + (ghostClusterHeight(child.id) > 0 ? 1 : 0)

        const childRes = layoutSubtree(child.id, childLevel, childY)
        childCenterYs.push(childRes.centerY)

        childY += childSubtreeH
        if (i < children.length - 1) childY += siblingExtra(child, children[i + 1])
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
      type: (node as BranchGraphNode).isTrack ? 'track' : node.kind === 'ghost' ? 'ghost' : 'task',
      trackId:
        (node as BranchGraphNode).trackId ||
        resolveTrackIdForNode(node, nodes) ||
        undefined,
    }

    layoutNodes.push(layoutNode)
    nodePosMap[node.id] = layoutNode

    return { centerY: calculatedCenterY, y: calculatedY, height: visualH }
  }

  // Root ảo không được vẽ: các con của nó là cột đầu tiên (level 0, X = START_X), xếp từ START_Y
  {
    // Phase có ghost: cột 0 dành cho ghost, mọi task gốc nằm cột 1 (thẳng hàng dù có ghost hay không)
    const rootBaseLevel = Object.keys(ghostsByTarget).length > 0 ? 1 : 0
    const rootChildren = visibleChildren(rootNode.id)
    let childY = CARD_DIMENSIONS.START_Y
    rootChildren.forEach((child, i) => {
      layoutSubtree(child.id, rootBaseLevel, childY)
      childY += measureSubtreeHeight(child.id)
      if (i < rootChildren.length - 1) childY += siblingExtra(child, rootChildren[i + 1])
    })
  }

  const isPlainTask = (id: string): boolean => {
    const n = nodes[id]
    return Boolean(n && n.kind === 'branch' && !(n as BranchGraphNode).isTrack)
  }

  // 6. Generate primary SVG Bézier edges for spanning tree (from parent right to child left)
  // Không vẽ dây từ root ảo.
  placedIds.forEach((childId) => {
    const parentId = parentMap[childId]
    if (!parentId || parentId === rootNode.id) return

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
      isDependency: isPlainTask(parentId) && isPlainTask(childId),
      ...bezierMid(startX, startY, midX, startY, midX, endY, endX, endY),
    })
  })

  // 7. Ghost là cha: đặt bên TRÁI task đích (cột level - 1), xếp dọc trong khối dọc của task đích
  Object.entries(ghostsByTarget).forEach(([targetTaskId, attachedGhosts]) => {
    const targetPos = nodePosMap[targetTaskId]
    if (!targetPos) return

    const ghostH = CARD_DIMENSIONS.GHOST_HEIGHT
    const ghostW = CARD_DIMENSIONS.GHOST_WIDTH
    const totalH = ghostClusterHeight(targetTaskId)

    // Căn theo task đích nhưng giữ trong khối dọc của nó để không đè thẻ khác trong cột ghost
    const blockTop = blockTopMap[targetTaskId] ?? targetPos.y
    const blockH = measureSubtreeHeight(targetTaskId)
    const maxStart = blockTop + blockH - totalH - CARD_DIMENSIONS.GAP_Y
    const startY = Math.min(Math.max(targetPos.centerY - totalH / 2, blockTop), Math.max(blockTop, maxStart))

    const ghostLevel = targetPos.level - 1
    const ghostX = columnX(ghostLevel)

    attachedGhosts.forEach((ghost, idx) => {
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
        level: ghostLevel,
        order: idx,
        type: 'ghost',
        trackId: targetPos.trackId,
      }

      layoutNodes.push(ghostLayoutNode)
      nodePosMap[ghost.id] = ghostLayoutNode
      placedIds.add(ghost.id)

      // Cubic Bezier: mép phải ghost → mép trái task đích (mũi tên chỉ vào task)
      const gX = ghostLayoutNode.right
      const gY = ghostLayoutNode.centerY
      const tX = targetPos.left
      const tY = targetPos.centerY
      const mid = (gX + tX) / 2
      const d = `M ${gX} ${gY} C ${mid} ${gY}, ${mid} ${tY}, ${tX} ${tY}`

      layoutEdges.push({
        id: `ghost-edge-${ghost.id}-${targetTaskId}`,
        sourceId: ghost.id,
        targetId: targetTaskId,
        d,
        direct: false,
        isGhost: true,
        isDependency: true,
        ...bezierMid(gX, gY, mid, gY, mid, tY, tX, tY),
      })
    })
  })

  // 7b. Add secondary prerequisite edges between branch tasks (AND-Join, cross-track)
  nodeList.forEach((n) => {
    if (n.kind !== 'branch') return
    const childPos = nodePosMap[n.id]
    if (!childPos) return

    const primaryParent = parentMap[n.id]

    n.parentIds.forEach((pId) => {
      if (pId === primaryParent || pId === rootNode.id || pId === 'root') return
      // Ghost là cha được nối bằng dây ghost → task ở trên
      if (nodes[pId]?.kind === 'ghost') return
      const parentPos = nodePosMap[pId]
      if (!parentPos) return

      const startX = parentPos.right
      const startY = parentPos.centerY
      const endX = childPos.left
      const endY = childPos.centerY

      const bendX = startX >= endX ? startX + 40 : (startX + endX) / 2
      const d = `M ${startX} ${startY} C ${bendX} ${startY}, ${bendX} ${endY}, ${endX} ${endY}`

      layoutEdges.push({
        id: `edge-${pId}-${n.id}`,
        sourceId: pId,
        targetId: n.id,
        d,
        direct: false,
        isGhost: false,
        isDependency: isPlainTask(pId) && isPlainTask(n.id),
        ...bezierMid(startX, startY, bendX, startY, bendX, endY, endX, endY),
      })
    })
  })

  // 8. Safety fallback: Place any unplaced / disconnected branch nodes only
  // (Loose, unanchored ghost nodes are explicitly discarded per specification; root ảo luôn ẩn)
  let fallbackY = Math.max(
    ...layoutNodes.map((n) => n.y + n.height),
    CARD_DIMENSIONS.START_Y
  ) + CARD_DIMENSIONS.GAP_Y

  nodeList.forEach((n) => {
    if (n.kind === 'ghost' || n.kind === 'root') return
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
        type: (n as BranchGraphNode).isTrack ? 'track' : 'task',
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
    const rootNode = Object.values(nodes).find((n) => n.kind === 'root')
    const rootId = rootNode ? rootNode.id : 'root'
    const existingTracks = Object.values(nodes).filter(
      (n): n is BranchGraphNode => n.kind === 'branch' && Boolean((n as BranchGraphNode).isTrack)
    )
    const trackOrder = customOrder !== undefined ? customOrder : existingTracks.length
    const id = `track-${Date.now()}`
    const code = `TRK-${String(trackOrder + 1).padStart(2, '0')}`
    const title = customTitle || `Track ${trackOrder + 1}: New branch`

    return {
      kind: 'branch',
      id,
      code,
      title,
      phaseId,
      trackId: id,
      parentId: rootId,
      parentIds: [rootId],
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
        ? `Waiting for ${sourceBranch.title || source.id} to be completed`
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

