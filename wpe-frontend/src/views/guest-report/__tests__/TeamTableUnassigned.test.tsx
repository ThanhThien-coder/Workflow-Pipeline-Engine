// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport } from '../../../domain/guestReport'
import type { GuestOverviewDto, GuestReportDto } from '../../../types/guest.types'
import { TeamTable } from '../sections/TeamTable'

/** G39: task không ai làm có một dòng "Unassigned" như thành viên, kể cả khi đã xong. */

const normalReport = (normalOverviewJson as unknown as GuestOverviewDto).report!

/** Bộ normal, cho WPE-15 (chưa giao) đã xong trước hạn. */
function reportWithDoneUnassigned(): GuestReportDto {
  const report = structuredClone(normalReport) as GuestReportDto
  const node = report.graph.nodes!.find((n) => n.code === 'WPE-15')!
  node.status = 'DONE'
  node.completedAt = '2026-11-20T05:00:00.000Z'
  return report
}

describe('G39 — dòng Unassigned ở bảng Who did what', () => {
  afterEach(() => cleanup())

  it('model: task chưa giao (đang mở) thành dòng Unassigned, không nằm trong rows', () => {
    const model = buildGuestReport(normalReport)
    expect(model.team.unassignedRow).not.toBeNull()
    expect(model.team.unassignedRow!.member.name).toBe('Unassigned')
    expect(model.team.unassignedRow!.total).toBe(1)
    expect(model.team.unassignedRow!.todo).toBe(1)
    expect(model.team.rows.some((r) => r.memberId === '__unassigned__')).toBe(false)
  })

  it('model: task chưa giao đã xong vẫn được tính (trước đây biến mất khỏi bảng)', () => {
    const model = buildGuestReport(reportWithDoneUnassigned())
    expect(model.team.unassignedTasks).toHaveLength(0)
    expect(model.team.unassignedRow!.done).toBe(1)
    expect(model.team.unassignedRow!.onTime).toBe(1)
    expect(model.team.unassignedRow!.onTimePct).toBe(100)
  })

  it('model: mọi task đều có người làm thì không có dòng Unassigned', () => {
    const report = structuredClone(normalReport) as GuestReportDto
    report.graph.nodes!.find((n) => n.code === 'WPE-15')!.assignedUserId = report.members[0].id
    expect(buildGuestReport(report).team.unassignedRow).toBeNull()
  })

  it('bảng: dòng Unassigned ở cuối, đủ cột như thành viên, số member không đếm dòng này', () => {
    const model = buildGuestReport(reportWithDoneUnassigned())
    render(<TeamTable model={model} avatarById={{}} />)

    const rows = screen.getAllByRole('row')
    const last = rows[rows.length - 1]
    expect(within(last).getByText('Unassigned')).toBeDefined()
    expect(within(last).getByText('No assignee')).toBeDefined()
    expect(within(last).getByText('1/1')).toBeDefined()
    expect(within(last).getByText('100%')).toBeDefined()
    expect(screen.queryByText(/open task has no assignee/i)).toBeNull()
    expect(screen.getByText(`${model.team.rows.length} members`)).toBeDefined()
  })
})
