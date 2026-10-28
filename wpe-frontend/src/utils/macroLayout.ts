import type { MacroPhase } from '../types/workflow.types'

export const MACRO_CARD_W = 380
export const MACRO_CARD_H = 180
export const MACRO_GAP_X = 90
export const MACRO_GAP_Y = 40

interface LayoutNode {
  phase: MacroPhase
  children: LayoutNode[]
  subtreeHeight: number
  col: number
  x: number
  y: number
}

export function computeMacroGraphLayout(phases: Record<string, MacroPhase>, rootPhaseId = 'p1'): Record<string, { x: number; y: number }> {
  const phaseList = Object.values(phases)
  if (phaseList.length === 0) return {}

  const phaseIds = new Set(phaseList.map((p) => p.id))

  // 1. Calculate topological depth (column) for every phase
  const colMap = new Map<string, number>()
  phaseList.forEach((p) => colMap.set(p.id, 0))

  for (let k = 0; k < phaseList.length; k++) {
    for (const phase of phaseList) {
      const currentParentIds = phase.parentPhaseIds.filter((pid) => phaseIds.has(pid))
      for (const pid of currentParentIds) {
        const parentCol = colMap.get(pid) ?? 0
        if (parentCol + 1 > (colMap.get(phase.id) ?? 0)) {
          colMap.set(phase.id, parentCol + 1)
        }
      }
    }
  }

  // 2. Identify roots
  const roots = phaseList.filter((phase) => phase.parentPhaseIds.filter((pid) => phaseIds.has(pid)).length === 0)
  const primaryRoots = roots.length > 0 ? roots : [phases[rootPhaseId] || phaseList[0]]
  const nodeMap = new Map<string, LayoutNode>()
  phaseList.forEach((phase) =>
    nodeMap.set(phase.id, {
      phase,
      children: [],
      subtreeHeight: MACRO_CARD_H,
      col: colMap.get(phase.id) ?? 0,
      x: 0,
      y: 0,
    })
  )

  // Build tree children using the first valid parent in the graph
  phaseList.forEach((phase) => {
    const parentId = phase.parentPhaseIds.find((pid) => nodeMap.has(pid))
    const parent = parentId ? nodeMap.get(parentId) : undefined
    const child = nodeMap.get(phase.id)
    if (parent && child && parent.phase.id !== child.phase.id) {
      if (!parent.children.some((c) => c.phase.id === child.phase.id)) {
        parent.children.push(child)
      }
    }
  })

  // 3. Assign X positions with topological column enforcement & cycle protection
  const assignColumns = (node: LayoutNode, col: number, visited = new Set<string>()) => {
    if (visited.has(node.phase.id)) return
    visited.add(node.phase.id)
    const effectiveCol = Math.max(colMap.get(node.phase.id) ?? col, col)
    node.col = effectiveCol
    node.x = 40 + effectiveCol * (MACRO_CARD_W + MACRO_GAP_X)
    node.children.forEach((child) => assignColumns(child, effectiveCol + 1, visited))
  }

  const measureSubtree = (node: LayoutNode, visited = new Set<string>()): number => {
    if (visited.has(node.phase.id)) return MACRO_CARD_H
    visited.add(node.phase.id)
    if (node.children.length === 0) return (node.subtreeHeight = MACRO_CARD_H)
    const childrenHeight =
      node.children.reduce((total, child) => total + measureSubtree(child, visited), 0) +
      (node.children.length - 1) * MACRO_GAP_Y
    return (node.subtreeHeight = Math.max(MACRO_CARD_H, childrenHeight))
  }

  const result: Record<string, { x: number; y: number }> = {}
  const placeTree = (node: LayoutNode, topY: number, visited = new Set<string>()) => {
    if (visited.has(node.phase.id)) return
    visited.add(node.phase.id)
    if (node.children.length === 0) {
      node.y = Math.max(60, topY)
    } else {
      let childY = topY
      node.children.forEach((child) => {
        placeTree(child, childY, visited)
        childY += child.subtreeHeight + MACRO_GAP_Y
      })
      const firstChild = node.children[0]
      const lastChild = node.children[node.children.length - 1]
      node.y = Math.max(
        60,
        Math.round(firstChild.y + (lastChild.y + MACRO_CARD_H - firstChild.y) / 2 - MACRO_CARD_H / 2)
      )
    }
    result[node.phase.id] = { x: node.x, y: node.y }
  }

  let rootY = 60
  primaryRoots.forEach((root) => {
    const rootNode = nodeMap.get(root.id)
    if (!rootNode) return
    assignColumns(rootNode, colMap.get(root.id) ?? 0)
    measureSubtree(rootNode)
    placeTree(rootNode, rootY)
    rootY += rootNode.subtreeHeight + MACRO_GAP_Y * 2
  })

  // Fallback for any unplaced disconnected phases
  phaseList.forEach((phase) => {
    if (!result[phase.id]) {
      const col = colMap.get(phase.id) ?? 0
      result[phase.id] = { x: 40 + col * (MACRO_CARD_W + MACRO_GAP_X), y: rootY }
      rootY += MACRO_CARD_H + MACRO_GAP_Y
    }
  })

  // 4. Collision resolution: Guarantee no two phases in the same column ever overlap vertically
  const cols = new Map<number, { id: string; y: number }[]>()
  Object.entries(result).forEach(([id, pos]) => {
    const colKey = Math.round((pos.x - 40) / (MACRO_CARD_W + MACRO_GAP_X))
    if (!cols.has(colKey)) cols.set(colKey, [])
    cols.get(colKey)!.push({ id, y: pos.y })
  })

  cols.forEach((items) => {
    items.sort((a, b) => a.y - b.y)
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]
      const curr = items[i]
      const minY = prev.y + MACRO_CARD_H + MACRO_GAP_Y
      if (curr.y < minY) {
        const diff = minY - curr.y
        curr.y = minY
        result[curr.id].y += diff
      }
    }
  })

  return result
}

export function computeSmartMacroPhasePosition(
  existingPhases: MacroPhase[],
  parentPhaseId?: string
): { x: number; y: number } {
  const STEP_X = MACRO_CARD_W + MACRO_GAP_X // 380 + 90 = 470
  const STEP_Y = MACRO_CARD_H + MACRO_GAP_Y // 180 + 40 = 220

  if (!existingPhases || existingPhases.length === 0) {
    return { x: 40, y: 60 }
  }

  let targetX = 40
  let targetY = 60

  if (parentPhaseId) {
    const parent = existingPhases.find((p) => p.id === parentPhaseId)
    if (parent) {
      targetX = (parent.x ?? 40) + STEP_X
      targetY = parent.y ?? 60

      // Find all existing phases in the target column (within +/- 180px)
      const phasesInColumn = existingPhases.filter(
        (p) => Math.abs((p.x ?? 0) - targetX) < 180
      )
      if (phasesInColumn.length > 0) {
        const maxY = Math.max(...phasesInColumn.map((p) => p.y ?? 60))
        targetY = maxY + STEP_Y
      }
    }
  } else {
    // Independent phase (root): stack downwards in the first column
    const rootPhases = existingPhases.filter((p) => !p.parentPhaseIds || p.parentPhaseIds.length === 0)
    const targetGroup = rootPhases.length > 0 ? rootPhases : existingPhases
    const phasesInCol0 = targetGroup.filter((p) => Math.abs((p.x ?? 0) - 40) < 180)

    if (phasesInCol0.length > 0) {
      const maxY = Math.max(...phasesInCol0.map((p) => p.y ?? 60))
      targetX = 40
      targetY = maxY + STEP_Y
    } else {
      const maxY = Math.max(...existingPhases.map((p) => p.y ?? 60))
      targetX = 40
      targetY = maxY + STEP_Y
    }
  }

  // Safety collision check: ensure no overlap with any existing phase
  while (
    existingPhases.some(
      (p) =>
        Math.abs((p.x ?? 0) - targetX) < 80 &&
        Math.abs((p.y ?? 0) - targetY) < 80
    )
  ) {
    targetY += STEP_Y
  }

  return { x: targetX, y: targetY }
}
