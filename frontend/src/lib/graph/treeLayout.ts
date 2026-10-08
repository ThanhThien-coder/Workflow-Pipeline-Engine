import type { TemplateNodeDto } from '../../types/template.types';

export const NODE_W = 210;
export const NODE_H = 62;
export const GAP_X = 70;
export const GAP_Y = 18;
export const PAD = 32;

interface InternalTreeNode {
  node: TemplateNodeDto;
  children: InternalTreeNode[];
}

export interface TreeLayoutResult {
  positions: Map<string, { x: number; y: number; depth: number }>;
  width: number;
  height: number;
  maxDepth: number;
}

/**
 * Pure Recursive Subtree Spacing layout algorithm.
 * Guarantees zero overlapping between sibling subtrees across arbitrary branching depth.
 */
export function calculateTreeLayoutWithBounds(nodes: TemplateNodeDto[]): TreeLayoutResult {
  const positions = new Map<string, { x: number; y: number; depth: number }>();

  if (nodes.length === 0) {
    return { positions, width: 0, height: 0, maxDepth: 0 };
  }

  // 1. Build hierarchy tree from flat nodes
  const nodeMap = new Map<string, InternalTreeNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, { node: n, children: [] });
  }

  const roots: InternalTreeNode[] = [];
  for (const n of nodes) {
    const item = nodeMap.get(n.id)!;
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }

  // If no root found (e.g. malformed parent cycle), treat the first node as root
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodeMap.get(nodes[0].id)!);
  }

  // 2. Step 1: Post-order height calculation
  const heightMap = new Map<InternalTreeNode, number>();

  function computeHeight(item: InternalTreeNode): number {
    if (item.children.length === 0) {
      heightMap.set(item, NODE_H);
      return NODE_H;
    }
    const childrenSum = item.children.reduce(
      (acc, c) => acc + computeHeight(c),
      0
    );
    const spacing = GAP_Y * (item.children.length - 1);
    const totalH = Math.max(NODE_H, childrenSum + spacing);
    heightMap.set(item, totalH);
    return totalH;
  }

  for (const r of roots) {
    computeHeight(r);
  }

  // 3. Step 2: Pre-order position assignment
  let maxDepth = 0;

  function placeNode(item: InternalTreeNode, depth: number, top: number) {
    maxDepth = Math.max(maxDepth, depth);
    const x = depth * (NODE_W + GAP_X);
    let y: number;

    const itemHeight = heightMap.get(item) || NODE_H;

    if (item.children.length === 0) {
      // Leaf node: center within its allocated vertical slot
      y = top + (itemHeight - NODE_H) / 2;
    } else {
      let currentChildTop = top;
      for (const child of item.children) {
        placeNode(child, depth + 1, currentChildTop);
        currentChildTop += (heightMap.get(child) || NODE_H) + GAP_Y;
      }
      // Inner node: center between first and last child
      const firstChildPos = positions.get(item.children[0].node.id)!;
      const lastChildPos = positions.get(item.children[item.children.length - 1].node.id)!;
      y = (firstChildPos.y + lastChildPos.y) / 2;
    }

    positions.set(item.node.id, { x, y, depth });
  }

  let rootTop = 0;
  for (const r of roots) {
    placeNode(r, 0, rootTop);
    rootTop += (heightMap.get(r) || NODE_H) + GAP_Y;
  }

  const totalHeight = rootTop > 0 ? rootTop - GAP_Y : 0;
  const totalWidth = (maxDepth + 1) * (NODE_W + GAP_X) - GAP_X;

  return {
    positions,
    width: Math.max(totalWidth, NODE_W),
    height: Math.max(totalHeight, NODE_H),
    maxDepth,
  };
}

/**
 * Standard pure calculateTreeLayout contract.
 * Returns Map<id, { x, y }>.
 */
export function calculateTreeLayout(nodes: TemplateNodeDto[]): Map<string, { x: number; y: number }> {
  const result = calculateTreeLayoutWithBounds(nodes);
  const map = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of result.positions.entries()) {
    map.set(id, { x: pos.x, y: pos.y });
  }
  return map;
}
