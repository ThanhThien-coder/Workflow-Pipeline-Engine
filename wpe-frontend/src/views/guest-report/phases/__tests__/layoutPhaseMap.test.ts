import { describe, expect, it } from 'vitest'
import normalFixture from '../../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport, type GuestReportPhase } from '../../../../domain/guestReport'
import type { GuestOverviewDto, GuestReportDto } from '../../../../types/guest.types'
import { PHASE_MAP_DIMS, layoutPhaseMap } from '../layoutPhaseMap'

const normalReport = (normalFixture as unknown as GuestOverviewDto).report as GuestReportDto
const normalModel = buildGuestReport(normalReport)

function makePhase(id: string, index: number, parentIds: string[]): GuestReportPhase {
  return {
    id,
    index,
    name: `Phase ${index + 1}`,
    tasks: [],
    done: 0,
    pct: 0,
    status: 'TODO',
    overdue: 0,
    late: 0,
    plannedEnd: null,
    start: null,
    end: null,
    verdict: { label: 'Not started', tone: 'slate' },
    onTimePct: null,
    parentIds,
  }
}

function rectsOverlap(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w: number,
  h: number,
): boolean {
  return a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y
}

describe('layoutPhaseMap', () => {
  it('xếp cột theo đường dài nhất và phát hiện cạnh nhảy cột trên dữ liệu normal', () => {
    const layout = layoutPhaseMap(normalModel.phases, normalReport.graph.phaseEdges)

    // 101 -> 102 -> 103 -> 104, cộng thêm cạnh nhảy cột 102 -> 104
    expect(layout.col['101']).toBe(0)
    expect(layout.col['102']).toBe(1)
    expect(layout.col['103']).toBe(2)
    expect(layout.col['104']).toBe(3)
    expect(layout.hasSkipEdge).toBe(true)

    // Không có cặp phase nào chồng nhau
    const { CW, CH } = PHASE_MAP_DIMS
    const ids = layout.phases.map((p) => p.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(rectsOverlap(layout.pos[ids[i]], layout.pos[ids[j]], CW, CH)).toBe(false)
      }
    }
  })

  it('xếp các nhánh song song vào cùng cột và không chồng nhau', () => {
    const phases = [
      makePhase('p0', 0, []),
      makePhase('p1', 1, ['p0']),
      makePhase('p2', 2, ['p0']),
      makePhase('p3', 3, ['p1', 'p2']),
      makePhase('none', -1, []), // unphased phải bị bỏ qua khỏi phase map
    ]

    const layout = layoutPhaseMap(phases)

    expect(layout.phases.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3'])
    expect(layout.col).toEqual({ p0: 0, p1: 1, p2: 1, p3: 2 })
    expect(layout.hasSkipEdge).toBe(false)

    const { CW, CH } = PHASE_MAP_DIMS
    const ids = layout.phases.map((p) => p.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(rectsOverlap(layout.pos[ids[i]], layout.pos[ids[j]], CW, CH)).toBe(false)
      }
    }
  })

  it('trả về rỗng khi không có phase thật nào', () => {
    const layout = layoutPhaseMap([makePhase('none', -1, [])])
    expect(layout.phases).toEqual([])
    expect(layout.w).toBe(0)
    expect(layout.h).toBe(0)
  })
})
