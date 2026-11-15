import type { MacroPhase } from '../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W, MACRO_GAP_X, MACRO_GAP_Y } from './macroLayout'

/**
 * T5 — Bố cục Macro theo cột của DAG phase và đường dây vuông góc chạy trong khe giữa các cột.
 * Cột = độ sâu dài nhất tính từ phase gốc, nên mọi dây luôn đi trái → phải.
 * x của thẻ luôn suy ra từ cột; y là vị trí người dùng chọn (đã lưu), tự đẩy xuống nếu đè thẻ khác cùng cột.
 */

export type Point = { x: number; y: number }
export type Positions = Record<string, Point>

const TOP = 60
const LEFT = 40

export function columnX(col: number): number {
  return LEFT + col * (MACRO_CARD_W + MACRO_GAP_X)
}

/** Cột của mỗi phase = độ sâu dài nhất theo parentPhaseIds (cha không tồn tại thì bỏ qua). */
export function phaseColumns(phases: Pick<MacroPhase, 'id' | 'parentPhaseIds'>[]): Record<string, number> {
  const ids = new Set(phases.map((p) => p.id))
  const col: Record<string, number> = Object.fromEntries(phases.map((p) => [p.id, 0]))
  // n vòng là đủ cho DAG; có vòng (dữ liệu hỏng) thì vẫn dừng
  for (let round = 0; round < phases.length; round++) {
    let changed = false
    for (const phase of phases) {
      for (const parent of phase.parentPhaseIds) {
        if (ids.has(parent) && col[parent] + 1 > col[phase.id]) {
          col[phase.id] = col[parent] + 1
          changed = true
        }
      }
    }
    if (!changed) break
  }
  return col
}

/** Đặt thẻ theo cột: x theo cột, y theo y mong muốn, đẩy xuống để không đè thẻ cùng cột. */
export function arrangePhases(
  phases: Pick<MacroPhase, 'id' | 'parentPhaseIds'>[],
  preferredY: Record<string, number>
): Positions {
  const cols = phaseColumns(phases)
  const byCol = new Map<number, string[]>()
  for (const phase of phases) {
    const list = byCol.get(cols[phase.id]) ?? []
    list.push(phase.id)
    byCol.set(cols[phase.id], list)
  }
  const result: Positions = {}
  byCol.forEach((ids, col) => {
    ids.sort((a, b) => (preferredY[a] ?? TOP) - (preferredY[b] ?? TOP) || a.localeCompare(b))
    let nextFree = 20
    for (const id of ids) {
      const y = Math.max(preferredY[id] ?? TOP, nextFree)
      result[id] = { x: columnX(col), y }
      nextFree = y + MACRO_CARD_H + MACRO_GAP_Y
    }
  })
  return result
}

/**
 * Auto Layout: giữ cột theo DAG, sắp thứ tự trong mỗi cột theo trung bình y của các phase cha
 * (heuristic barycenter) để ít dây cắt nhau, xếp sát nhau trong cột, và căn giữa mỗi cột theo chiều dọc
 * so với cột cao nhất (G19: trước đây mọi cột dồn lên đầu).
 */
export function autoLayoutColumns(phases: Pick<MacroPhase, 'id' | 'parentPhaseIds'>[], currentY: Record<string, number>): Positions {
  const cols = phaseColumns(phases)
  const maxCol = Math.max(0, ...Object.values(cols))
  const step = MACRO_CARD_H + MACRO_GAP_Y
  const countOf = (col: number) => phases.filter((p) => cols[p.id] === col).length
  const tallest = Math.max(1, ...Array.from({ length: maxCol + 1 }, (_, col) => countOf(col)))
  const result: Positions = {}
  for (let col = 0; col <= maxCol; col++) {
    const inCol = phases.filter((p) => cols[p.id] === col)
    // Cột ít thẻ hơn cột cao nhất thì đẩy xuống nửa phần chênh lệch
    const top = TOP + ((tallest - inCol.length) * step) / 2
    const key = (p: (typeof inCol)[number]) => {
      const placedParents = p.parentPhaseIds.map((id) => result[id]?.y).filter((y): y is number => y != null)
      return placedParents.length ? placedParents.reduce((a, b) => a + b, 0) / placedParents.length : currentY[p.id] ?? TOP
    }
    inCol.sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id))
    inCol.forEach((p, i) => {
      result[p.id] = { x: columnX(col), y: top + i * step }
    })
  }
  return result
}

/**
 * Lệch ngang của đoạn dọc trong khe cho từng phase nguồn: các nguồn khác nhau cùng cột không chồng đoạn dọc lên nhau.
 * Nguồn trong một cột sắp theo y, lệch đều quanh giữa khe.
 */
export function channelOffsets(edges: [string, string][], positions: Positions, cols: Record<string, number>): Record<string, number> {
  const sourcesByCol = new Map<number, Set<string>>()
  for (const [from] of edges) {
    if (!positions[from]) continue
    const set = sourcesByCol.get(cols[from]) ?? new Set<string>()
    set.add(from)
    sourcesByCol.set(cols[from], set)
  }
  const step = 10
  const limit = MACRO_GAP_X / 2 - 10
  const result: Record<string, number> = {}
  sourcesByCol.forEach((set) => {
    const sorted = [...set].sort((a, b) => positions[a].y - positions[b].y)
    sorted.forEach((id, i) => {
      const raw = (i - (sorted.length - 1) / 2) * step
      result[id] = Math.max(-limit, Math.min(limit, raw))
    })
  })
  return result
}

/** Chọn y cho đoạn ngang đi qua các cột ở giữa: không cắt thẻ nào, gần y nguồn/đích nhất. */
function pickLane(y1: number, y2: number, obstacles: Point[]): number {
  const margin = 8
  const isFree = (y: number) => obstacles.every((o) => y < o.y - margin || y > o.y + MACRO_CARD_H + margin)
  const candidates = [y1, y2, ...obstacles.flatMap((o) => [o.y - MACRO_GAP_Y / 2, o.y + MACRO_CARD_H + MACRO_GAP_Y / 2])]
  const free = candidates.filter(isFree)
  const cost = (y: number) => Math.abs(y - y1) + Math.abs(y - y2)
  return free.length ? free.reduce((best, y) => (cost(y) < cost(best) ? y : best)) : Math.min(y1, y2)
}

/** Chuỗi path SVG qua các điểm, bo tròn góc bán kính r. */
export function roundedPath(points: Point[], r = 10): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, cur, next] = [points[i - 1], points[i], points[i + 1]]
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y)
    const rr = Math.min(r, inLen / 2, outLen / 2)
    if (rr <= 0) {
      d += ` L${cur.x} ${cur.y}`
      continue
    }
    const before = { x: cur.x - ((cur.x - prev.x) / inLen) * rr, y: cur.y - ((cur.y - prev.y) / inLen) * rr }
    const after = { x: cur.x + ((next.x - cur.x) / outLen) * rr, y: cur.y + ((next.y - cur.y) / outLen) * rr }
    d += ` L${before.x} ${before.y} Q${cur.x} ${cur.y} ${after.x} ${after.y}`
  }
  const last = points[points.length - 1]
  return `${d} L${last.x} ${last.y}`
}

export interface EdgeRoute {
  points: Point[]
  d: string
  /** Điểm đặt nút ✕ gỡ dây. */
  mid: Point
}

/**
 * Đường dây vuông góc từ cạnh phải thẻ nguồn tới cạnh trái thẻ đích.
 * Cột kề nhau: ngang → dọc trong khe → ngang. Vượt nhiều cột: đi ngang ở khe giữa hai hàng thẻ của các cột trung gian.
 * Đích không nằm bên phải (chỉ xảy ra lúc đang kéo thẻ): vẽ cong tạm thời.
 */
export function routeEdge(
  from: Point,
  to: Point,
  fromCol: number,
  toCol: number,
  middleObstacles: Point[],
  offset = 0
): EdgeRoute {
  const x1 = from.x + MACRO_CARD_W
  const y1 = from.y + MACRO_CARD_H / 2
  const x2 = to.x
  const y2 = to.y + MACRO_CARD_H / 2

  if (toCol <= fromCol || x2 <= x1) {
    const dx = Math.max(Math.abs(x2 - x1) * 0.5, 40)
    return {
      points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
      d: `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`,
      mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    }
  }

  const cx1 = x1 + MACRO_GAP_X / 2 + offset
  if (toCol === fromCol + 1) {
    const points = [{ x: x1, y: y1 }, { x: cx1, y: y1 }, { x: cx1, y: y2 }, { x: x2, y: y2 }]
    return { points, d: roundedPath(points), mid: { x: cx1, y: (y1 + y2) / 2 } }
  }

  const cx2 = x2 - MACRO_GAP_X / 2 + offset
  const lane = pickLane(y1, y2, middleObstacles)
  const points = [
    { x: x1, y: y1 }, { x: cx1, y: y1 }, { x: cx1, y: lane },
    { x: cx2, y: lane }, { x: cx2, y: y2 }, { x: x2, y: y2 },
  ]
  return { points, d: roundedPath(points), mid: { x: (cx1 + cx2) / 2, y: lane } }
}
