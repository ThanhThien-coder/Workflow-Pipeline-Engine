// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport, type GuestReportMetrics, type GuestReportModel } from '../../../domain/guestReport'
import type { GuestOverviewDto } from '../../../types/guest.types'
import { hasNoDueDates } from '../sections/helpers'
import { HealthPill } from '../sections/ProjectHeader'
import { KpiGrid } from '../sections/KpiGrid'

/** G38: chưa task nào có hạn chót thì không báo "đạt hết" / "On track". */

const normal = buildGuestReport((normalOverviewJson as unknown as GuestOverviewDto).report!)

function withoutDueDates(model: GuestReportModel): GuestReportModel {
  return {
    ...model,
    tasks: model.tasks.map((t) => ({ ...t, due: null })),
    metrics: { ...model.metrics, missed: 0, overdue: [], lateDone: [] },
  }
}

function metrics(over: Partial<GuestReportMetrics>): GuestReportMetrics {
  return { completed: false, lateDone: [], overdue: [], ...over } as unknown as GuestReportMetrics
}

describe('G38 — không có hạn chót', () => {
  afterEach(() => cleanup())

  it('hasNoDueDates: đúng khi mọi task thiếu hạn chót (kể cả chưa có task), sai khi có một task có hạn', () => {
    expect(hasNoDueDates([])).toBe(true)
    expect(hasNoDueDates([{ due: null }, { due: null }])).toBe(true)
    expect(hasNoDueDates([{ due: null }, { due: new Date('2026-12-01T00:00:00Z') }])).toBe(false)
  })

  it('thẻ Missed deadlines: không có hạn chót thì hiện "—" và "No due dates to check yet", không phải 0 xanh', () => {
    render(<KpiGrid model={withoutDueDates(normal)} onOverdue={() => {}} />)
    expect(screen.getByText('No due dates to check yet')).toBeDefined()
    expect(screen.queryByText('Every due date met so far')).toBeNull()
  })

  it('thẻ Missed deadlines: có hạn chót và chưa trễ thì giữ "Every due date met so far"', () => {
    const model = { ...normal, metrics: { ...normal.metrics, missed: 0, overdue: [], lateDone: [] } }
    render(<KpiGrid model={model} onOverdue={() => {}} />)
    expect(screen.getByText('Every due date met so far')).toBeDefined()
  })

  it('nhãn đầu trang: đang chạy, không hạn chót → "In progress"; có hạn chót → "On track"', () => {
    const { rerender } = render(<HealthPill metrics={metrics({})} noDueDates />)
    expect(screen.getByText('In progress')).toBeDefined()
    expect(screen.queryByText('On track')).toBeNull()

    rerender(<HealthPill metrics={metrics({})} />)
    expect(screen.getByText('On track')).toBeDefined()
  })

  it('nhãn đầu trang: dự án đã xong, không hạn chót → "Delivered" (không ghi "all on time")', () => {
    const { rerender } = render(<HealthPill metrics={metrics({ completed: true })} noDueDates />)
    expect(screen.getByText('Delivered')).toBeDefined()

    rerender(<HealthPill metrics={metrics({ completed: true })} />)
    expect(screen.getByText('Delivered · all on time')).toBeDefined()
  })
})
