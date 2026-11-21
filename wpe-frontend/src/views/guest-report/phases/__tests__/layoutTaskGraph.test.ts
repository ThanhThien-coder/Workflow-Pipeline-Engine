import { describe, expect, it } from 'vitest'
import normalFixture from '../../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport } from '../../../../domain/guestReport'
import type { GuestOverviewDto, GuestReportDto } from '../../../../types/guest.types'
import { TASK_GRAPH_DIMS, countTaskGraphGhosts, layoutTaskGraph } from '../layoutTaskGraph'

const normalReport = (normalFixture as unknown as GuestOverviewDto).report as GuestReportDto
const normalModel = buildGuestReport(normalReport)

function rectsOverlap(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w: number,
  h: number,
): boolean {
  return a.x < b.x + w && a.x + w > b.x && a.y < b.y + h && a.y + h > b.y
}

describe('layoutTaskGraph', () => {
  it('xếp vị trí các node (kể cả ghost) không chồng nhau cho mọi phase trong dữ liệu normal', () => {
    const { NW, NH } = TASK_GRAPH_DIMS

    for (const phase of normalModel.phases) {
      for (const showGhosts of [false, true]) {
        const layout = layoutTaskGraph(phase, normalModel.byId, showGhosts)
        expect(layout.nodes.length).toBeGreaterThanOrEqual(phase.tasks.length)

        for (let i = 0; i < layout.nodes.length; i++) {
          for (let j = i + 1; j < layout.nodes.length; j++) {
            const a = layout.pos[layout.nodes[i].id]
            const b = layout.pos[layout.nodes[j].id]
            expect(rectsOverlap(a, b, NW, NH)).toBe(false)
          }
        }
      }
    }
  })

  it('tạo đúng ghost upstream/downstream khi bật showGhosts và bỏ qua khi tắt', () => {
    // Phase 102 (Design): có upstream WPE-03, WPE-04 (Phase 101) và downstream WPE-11, WPE-13, WPE-16 (Phase 103), WPE-19 (Phase 104)
    const designPhase = normalModel.phases.find((p) => p.id === '102')!

    expect(countTaskGraphGhosts(designPhase, normalModel.byId)).toBe(6)

    const withGhosts = layoutTaskGraph(designPhase, normalModel.byId, true)
    expect(withGhosts.ups).toBe(2)
    expect(withGhosts.downs).toBe(4)
    expect(withGhosts.nodes.filter((n) => n.dir === 'up').length).toBe(2)
    expect(withGhosts.nodes.filter((n) => n.dir === 'down').length).toBe(4)

    // Mọi upstream ghost nằm ở cột trái cùng (x = PAD)
    for (const n of withGhosts.nodes.filter((x) => x.dir === 'up')) {
      expect(withGhosts.pos[n.id].x).toBe(TASK_GRAPH_DIMS.PAD)
    }

    const withoutGhosts = layoutTaskGraph(designPhase, normalModel.byId, false)
    expect(withoutGhosts.ups).toBe(0)
    expect(withoutGhosts.downs).toBe(0)
    expect(withoutGhosts.nodes.length).toBe(designPhase.tasks.length)
  })

  it('trả về rỗng an toàn khi phase chưa có task', () => {
    const emptyPhase = { ...normalModel.phases[0], tasks: [] }
    const layout = layoutTaskGraph(emptyPhase, normalModel.byId, true)
    expect(layout.nodes).toEqual([])
    expect(layout.edges).toEqual([])
    expect(layout.w).toBe(0)
    expect(layout.h).toBe(0)
  })
})
