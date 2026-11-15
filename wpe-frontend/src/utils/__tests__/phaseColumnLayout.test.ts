import { describe, it, expect } from 'vitest'
import {
  arrangePhases, autoLayoutColumns, channelOffsets, columnX, phaseColumns, routeEdge, type Point, type Positions,
} from '../phaseColumnLayout'
import { MACRO_CARD_H, MACRO_CARD_W, MACRO_GAP_Y } from '../macroLayout'

/** T5 (G3) — phase xếp theo cột DAG, dây vuông góc không cắt qua thẻ. */

const p = (id: string, parentPhaseIds: string[] = []) => ({ id, parentPhaseIds })

// Sơ đồ như ảnh G3: IaC → CI/CD, P3, P4, P5; P3 → P6; P4 → P6; P5 → P7; IaC → P7 (vượt cột)
const PHASES = [
  p('iac'), p('cicd', ['iac']), p('p3', ['iac']), p('p4', ['iac']), p('p5', ['iac']),
  p('p6', ['p3', 'p4']), p('p7', ['p5', 'iac']),
]
const EDGES: [string, string][] = [
  ['iac', 'cicd'], ['iac', 'p3'], ['iac', 'p4'], ['iac', 'p5'], ['p3', 'p6'], ['p4', 'p6'], ['p5', 'p7'], ['iac', 'p7'],
]

function inside(pt: Point, card: Point): boolean {
  return pt.x > card.x && pt.x < card.x + MACRO_CARD_W && pt.y > card.y && pt.y < card.y + MACRO_CARD_H
}

/** Lấy mẫu dọc từng đoạn thẳng của đường dây, kiểm không điểm nào nằm trong thẻ (trừ thẻ nguồn/đích). */
function crossesAnyCard(points: Point[], cards: Point[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]]
    for (let t = 0; t <= 1; t += 0.02) {
      const pt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      if (cards.some((c) => inside(pt, c))) return true
    }
  }
  return false
}

describe('phaseColumns', () => {
  it('cột = độ sâu dài nhất; phase luôn ở bên phải mọi phase cha', () => {
    const cols = phaseColumns(PHASES)
    expect(cols).toMatchObject({ iac: 0, cicd: 1, p3: 1, p4: 1, p5: 1, p6: 2, p7: 2 })
    for (const phase of PHASES) for (const parent of phase.parentPhaseIds) expect(cols[phase.id]).toBeGreaterThan(cols[parent])
  })

  it('có vòng (dữ liệu hỏng) vẫn dừng, không treo', () => {
    expect(() => phaseColumns([p('a', ['b']), p('b', ['a'])])).not.toThrow()
  })
})

describe('arrangePhases', () => {
  it('x theo cột (bỏ qua x đã lưu); y giữ theo ý người dùng, đẩy xuống nếu đè thẻ cùng cột', () => {
    const pos = arrangePhases([p('a'), p('b', ['a']), p('c', ['a'])], { a: 100, b: 100, c: 120 })

    expect(pos.a).toEqual({ x: columnX(0), y: 100 })
    expect(pos.b).toEqual({ x: columnX(1), y: 100 })
    expect(pos.c.x).toBe(columnX(1))
    expect(pos.c.y).toBe(100 + MACRO_CARD_H + MACRO_GAP_Y)
  })

  it('nối dây làm phase sâu hơn thì tự sang cột bên phải', () => {
    const before = arrangePhases([p('a'), p('b'), p('c')], { a: 60, b: 300, c: 540 })
    expect(before.c.x).toBe(columnX(0))
    const after = arrangePhases([p('a'), p('b', ['a']), p('c', ['b'])], { a: 60, b: 300, c: 540 })
    expect(after.c.x).toBe(columnX(2))
  })
})

describe('autoLayoutColumns', () => {
  it('xếp sát nhau từ trên xuống; con sắp theo vị trí cha (ít cắt nhau)', () => {
    const pos = autoLayoutColumns([p('a'), p('b'), p('x', ['b']), p('y', ['a'])], { a: 60, b: 300 })

    expect(pos.a.y).toBeLessThan(pos.b.y)
    expect(pos.y.y).toBeLessThan(pos.x.y) // y có cha a ở trên → y ở trên
    expect(pos.x.x).toBe(columnX(1))
  })

  it('G19: cột ít thẻ được căn giữa theo chiều dọc so với cột cao nhất (không dồn lên đầu)', () => {
    // Sơ đồ như ảnh: A → P2, P3, P4; P2, P3 → P5; P5 → P6; P2 → P6 (vượt cột)
    const phases = [p('a'), p('p2', ['a']), p('p3', ['a']), p('p4', ['a']), p('p5', ['p2', 'p3']), p('p6', ['p5', 'p2'])]
    const pos = autoLayoutColumns(phases, {})
    const cols = phaseColumns(phases)

    const middleRow = pos.p3.y
    expect(pos.p2.y).toBeLessThan(middleRow)
    expect(pos.p4.y).toBeGreaterThan(middleRow)
    expect(pos.a.y).toBe(middleRow)
    expect(pos.p5.y).toBe(middleRow)
    expect(pos.p6.y).toBe(middleRow)

    // Dây vẫn không cắt qua thẻ nào
    const edges: [string, string][] = [['a', 'p2'], ['a', 'p3'], ['a', 'p4'], ['p2', 'p5'], ['p3', 'p5'], ['p5', 'p6'], ['p2', 'p6']]
    const offsets = channelOffsets(edges, pos, cols)
    for (const [from, to] of edges) {
      const middle = phases.filter((ph) => cols[ph.id] > cols[from] && cols[ph.id] < cols[to]).map((ph) => pos[ph.id])
      const route = routeEdge(pos[from], pos[to], cols[from], cols[to], middle, offsets[from])
      const others = phases.filter((ph) => ph.id !== from && ph.id !== to).map((ph) => pos[ph.id])
      expect(crossesAnyCard(route.points, others)).toBe(false)
    }
  })

  it('G19: hai cột bằng nhau thì không lệch', () => {
    const pos = autoLayoutColumns([p('a'), p('b'), p('x', ['a']), p('y', ['b'])], {})
    expect(pos.a.y).toBe(pos.x.y)
    expect(pos.b.y).toBe(pos.y.y)
  })
})

describe('routeEdge', () => {
  function scene(): { pos: Positions; cols: Record<string, number> } {
    const cols = phaseColumns(PHASES)
    const pos = autoLayoutColumns(PHASES, {})
    return { pos, cols }
  }

  it('mọi dây trong sơ đồ G3: bắt đầu ở cạnh phải nguồn, kết thúc ở cạnh trái đích, không cắt qua thẻ nào khác', () => {
    const { pos, cols } = scene()
    const offsets = channelOffsets(EDGES, pos, cols)

    for (const [from, to] of EDGES) {
      const middle = PHASES.filter((ph) => cols[ph.id] > cols[from] && cols[ph.id] < cols[to]).map((ph) => pos[ph.id])
      const route = routeEdge(pos[from], pos[to], cols[from], cols[to], middle, offsets[from])
      const start = route.points[0]
      const end = route.points[route.points.length - 1]

      expect(start).toEqual({ x: pos[from].x + MACRO_CARD_W, y: pos[from].y + MACRO_CARD_H / 2 })
      expect(end).toEqual({ x: pos[to].x, y: pos[to].y + MACRO_CARD_H / 2 })
      const others = PHASES.filter((ph) => ph.id !== from && ph.id !== to).map((ph) => pos[ph.id])
      expect(crossesAnyCard(route.points, others)).toBe(false)
      // Đoạn cuối đi ngang vào đích từ bên trái (mũi tên chỉ sang phải)
      const beforeEnd = route.points[route.points.length - 2]
      expect(beforeEnd.y).toBe(end.y)
      expect(beforeEnd.x).toBeLessThan(end.x)
    }
  })

  it('dây vượt cột (IaC → P7) đi ngang ở khe giữa hai thẻ, không xuyên cột giữa', () => {
    const { pos, cols } = scene()
    const middle = PHASES.filter((ph) => cols[ph.id] === 1).map((ph) => pos[ph.id])
    const route = routeEdge(pos.iac, pos.p7, 0, 2, middle)

    expect(route.points).toHaveLength(6)
    expect(crossesAnyCard(route.points, middle)).toBe(false)
  })

  it('các nguồn khác nhau cùng cột có đoạn dọc lệch nhau, không chồng', () => {
    const { pos, cols } = scene()
    const offsets = channelOffsets(EDGES, pos, cols)
    expect(offsets.p3).not.toBe(offsets.p4)
    expect(offsets.p4).not.toBe(offsets.p5)
  })
})
