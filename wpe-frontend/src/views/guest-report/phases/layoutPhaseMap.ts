import type { GuestReportPhase } from '../../../domain/guestReport'

export const PHASE_MAP_DIMS = {
  CW: 196,
  CH: 104,
  GX: 52,
  GY: 14,
  PAD: 14,
} as const

export interface PhaseMapPoint {
  x: number
  y: number
}

export interface PhaseMapLayout {
  phases: GuestReportPhase[]
  edges: Array<[string, string]>
  pos: Record<string, PhaseMapPoint>
  col: Record<string, number>
  w: number
  h: number
  lane: number
  hasSkipEdge: boolean
}

/**
 * Xếp cột các phase theo đường dài nhất (chép từ PhaseMap trong mock v6).
 * Cạnh nhảy cột (col[b] - col[a] > 1) đi theo làn `lane` ở dưới hàng thẻ.
 */
export function layoutPhaseMap(
  allPhases: ReadonlyArray<GuestReportPhase>,
  extraPhaseEdges?: ReadonlyArray<ReadonlyArray<string | number>> | null,
): PhaseMapLayout {
  const { CW, CH, GX, GY, PAD } = PHASE_MAP_DIMS
  const phases = allPhases.filter((p) => p.index >= 0)

  if (phases.length === 0) {
    return { phases: [], edges: [], pos: {}, col: {}, w: 0, h: 0, lane: 0, hasSkipEdge: false }
  }

  const col: Record<string, number> = {}
  for (const p of phases) {
    col[p.id] = 0
  }

  const edgeKeys = new Set<string>()
  const edges: Array<[string, string]> = []
  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return
    if (col[fromId] === undefined || col[toId] === undefined) return
    const key = `${fromId}->${toId}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push([fromId, toId])
  }

  for (const p of phases) {
    for (const parentId of p.parentIds) {
      addEdge(parentId, p.id)
    }
  }
  for (const edge of extraPhaseEdges ?? []) {
    if (!Array.isArray(edge) || edge.length < 2) continue
    addEdge(String(edge[0]), String(edge[1]))
  }

  // Bellman-Ford kiểu đường dài nhất trên DAG (chạy tối đa phases.length lượt để an toàn nếu dữ liệu có chu trình)
  for (let round = 0; round < phases.length; round++) {
    let changed = false
    for (const [a, b] of edges) {
      const nextCol = col[a] + 1
      if (nextCol > col[b]) {
        col[b] = nextCol
        changed = true
      }
    }
    if (!changed) break
  }

  const maxC = Math.max(0, ...Object.values(col))
  const pos: Record<string, PhaseMapPoint> = {}
  let rows = 1

  for (let c = 0; c <= maxC; c++) {
    const inCol = phases.filter((p) => col[p.id] === c)
    rows = Math.max(rows, inCol.length)
    inCol.forEach((p, i) => {
      pos[p.id] = {
        x: PAD + c * (CW + GX),
        y: PAD + i * (CH + GY),
      }
    })
  }

  const hasSkipEdge = edges.some(([a, b]) => col[b] - col[a] > 1)
  const body = PAD * 2 + rows * CH + (rows - 1) * GY

  return {
    phases,
    edges,
    pos,
    col,
    w: PAD * 2 + (maxC + 1) * CW + maxC * GX,
    h: body + (hasSkipEdge ? 26 : 0),
    lane: body + 8,
    hasSkipEdge,
  }
}
