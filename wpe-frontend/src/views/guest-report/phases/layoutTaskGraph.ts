import type { GuestReportPhase, GuestTask } from '../../../domain/guestReport'

export interface TaskGraphDims {
  NW: number
  NH: number
  CG: number
  RG: number
  PAD: number
}

export const TASK_GRAPH_DIMS: TaskGraphDims = {
  NW: 190,
  NH: 70,
  CG: 60,
  RG: 14,
  PAD: 18,
}

export type TaskGraphGhostDir = 'up' | 'down' | null

export interface TaskGraphNode {
  id: string
  ref: GuestTask
  dir: TaskGraphGhostDir
}

export interface TaskGraphEdge {
  from: string
  to: string
}

export interface TaskGraphPoint {
  x: number
  y: number
}

export interface TaskGraphLayout {
  nodes: TaskGraphNode[]
  pos: Record<string, TaskGraphPoint>
  edges: TaskGraphEdge[]
  w: number
  h: number
  ups: number
  downs: number
}

/** Đếm số task ở phase khác có nối trực tiếp với phase đang xem (ghost cards). */
export function countTaskGraphGhosts(
  phase: GuestReportPhase,
  byId: Record<string, GuestTask>,
): number {
  const inSet = new Set(phase.tasks.map((t) => t.id))
  const ghosts = new Set<string>()
  for (const t of phase.tasks) {
    for (const d of t.deps) {
      if (!inSet.has(d) && byId[d]) ghosts.add(d)
    }
    for (const c of t.dependents) {
      if (!inSet.has(c) && byId[c]) ghosts.add(c)
    }
  }
  return ghosts.size
}

/**
 * Sắp xếp đồ thị task của một phase theo độ sâu phụ thuộc + sắp xếp barycenter giảm cắt cạnh
 * (hàm thuần, chép từ layoutTaskGraph trong mock v6).
 */
export function layoutTaskGraph(
  phase: GuestReportPhase,
  byId: Record<string, GuestTask>,
  showGhosts: boolean,
  dims: TaskGraphDims = TASK_GRAPH_DIMS,
): TaskGraphLayout {
  const { NW, NH, CG, RG, PAD } = dims
  if (phase.tasks.length === 0) {
    return { nodes: [], pos: {}, edges: [], w: 0, h: 0, ups: 0, downs: 0 }
  }

  const inSet = new Set(phase.tasks.map((t) => t.id))
  const ups = new Map<string, TaskGraphNode>()
  const downs = new Map<string, TaskGraphNode>()

  if (showGhosts) {
    for (const t of phase.tasks) {
      for (const d of t.deps) {
        if (!inSet.has(d) && byId[d]) {
          ups.set(d, { id: `u:${d}`, ref: byId[d], dir: 'up' })
        }
      }
      for (const c of t.dependents) {
        if (!inSet.has(c) && byId[c]) {
          downs.set(c, { id: `d:${c}`, ref: byId[c], dir: 'down' })
        }
      }
    }
  }

  const base = ups.size > 0 ? 1 : 0
  const level: Record<string, number> = {}
  const lv = (t: GuestTask): number => {
    if (level[t.id] !== undefined) return level[t.id]
    level[t.id] = base
    let L = base
    for (const d of t.deps) {
      if (inSet.has(d) && byId[d]) {
        L = Math.max(L, lv(byId[d]) + 1)
      }
    }
    level[t.id] = L
    return L
  }

  phase.tasks.forEach(lv)
  const maxL = Math.max(base, ...phase.tasks.map((t) => level[t.id]))

  const cols: TaskGraphNode[][] = []
  const push = (colIdx: number, node: TaskGraphNode) => {
    if (!cols[colIdx]) cols[colIdx] = []
    cols[colIdx].push(node)
  }

  for (const n of ups.values()) push(0, n)
  for (const t of phase.tasks) push(level[t.id], { id: t.id, ref: t, dir: null })
  for (const n of downs.values()) push(maxL + 1, n)

  const parentsOf = (n: TaskGraphNode): string[] => {
    if (n.dir === 'up') return []
    if (n.dir === 'down') return n.ref.deps.filter((d) => inSet.has(d))
    return n.ref.deps
      .map((d) => (inSet.has(d) ? d : `u:${d}`))
      .filter((d) => !d.startsWith('u:') || showGhosts)
  }

  const pos: Record<string, TaskGraphPoint> = {}
  cols.forEach((col, colIdx) => {
    if (!col) return
    if (colIdx > 0) {
      const bary = (n: TaskGraphNode): number => {
        const ps = parentsOf(n).filter((p) => pos[p] !== undefined)
        return ps.length > 0 ? ps.reduce((sum, p) => sum + pos[p].y, 0) / ps.length : 1e9
      }
      col.sort((a, b) => bary(a) - bary(b))
    }
    col.forEach((n, rowIdx) => {
      pos[n.id] = {
        x: PAD + colIdx * (NW + CG),
        y: PAD + rowIdx * (NH + RG),
      }
    })
  })

  const nodes = cols.flat().filter(Boolean)
  const edges: TaskGraphEdge[] = []
  for (const n of nodes) {
    for (const p of parentsOf(n)) {
      if (pos[p]) {
        edges.push({ from: p, to: n.id })
      }
    }
  }

  const nonEmptyCols = cols.filter(Boolean)
  const rows = Math.max(1, ...nonEmptyCols.map((c) => c.length))
  const w = PAD * 2 + cols.length * (NW + CG) - CG
  const h = PAD * 2 + rows * (NH + RG) - RG

  return {
    nodes,
    pos,
    edges,
    w,
    h,
    ups: ups.size,
    downs: downs.size,
  }
}
