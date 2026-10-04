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

  const roots = phaseList.filter((phase) => phase.parentPhaseIds.length === 0)
  const primaryRoots = roots.length > 0 ? roots : [phases[rootPhaseId] || phaseList[0]]
  const nodeMap = new Map<string, LayoutNode>()
  phaseList.forEach((phase) => nodeMap.set(phase.id, { phase, children: [], subtreeHeight: MACRO_CARD_H, col: 0, x: 0, y: 0 }))

  phaseList.forEach((phase) => {
    const parentId = phase.parentPhaseIds[0]
    const parent = parentId ? nodeMap.get(parentId) : undefined
    const child = nodeMap.get(phase.id)
    if (parent && child) parent.children.push(child)
  })

  const assignColumns = (node: LayoutNode, col: number) => {
    node.col = col
    node.x = 40 + col * (MACRO_CARD_W + MACRO_GAP_X)
    node.children.forEach((child) => assignColumns(child, col + 1))
  }
  const measureSubtree = (node: LayoutNode): number => {
    if (node.children.length === 0) return (node.subtreeHeight = MACRO_CARD_H)
    const childrenHeight = node.children.reduce((total, child) => total + measureSubtree(child), 0) + (node.children.length - 1) * MACRO_GAP_Y
    return (node.subtreeHeight = Math.max(MACRO_CARD_H, childrenHeight))
  }

  const result: Record<string, { x: number; y: number }> = {}
  const placeTree = (node: LayoutNode, topY: number) => {
    if (node.children.length === 0) node.y = topY
    else {
      let childY = topY
      node.children.forEach((child) => {
        placeTree(child, childY)
        childY += child.subtreeHeight + MACRO_GAP_Y
      })
      const firstChild = node.children[0]
      const lastChild = node.children[node.children.length - 1]
      node.y = firstChild.y + (lastChild.y + MACRO_CARD_H - firstChild.y) / 2 - MACRO_CARD_H / 2
    }
    result[node.phase.id] = { x: node.x, y: node.y }
  }

  let rootY = 60
  primaryRoots.forEach((root) => {
    const rootNode = nodeMap.get(root.id)
    if (!rootNode) return
    assignColumns(rootNode, 0)
    measureSubtree(rootNode)
    placeTree(rootNode, rootY)
    rootY += rootNode.subtreeHeight + MACRO_GAP_Y * 2
  })

  phaseList.forEach((phase) => {
    if (!result[phase.id]) {
      result[phase.id] = { x: phase.x || 40, y: rootY }
      rootY += MACRO_CARD_H + MACRO_GAP_Y
    }
  })
  return result
}
