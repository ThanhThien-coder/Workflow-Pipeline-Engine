// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport } from '../../../domain/guestReport'
import type { GuestOverviewDto } from '../../../types/guest.types'
import { PhaseScorecard } from '../sections/PhaseScorecard'

const normalOverview = normalOverviewJson as unknown as GuestOverviewDto

describe('PhaseScorecard', () => {
  afterEach(() => cleanup())

  it('hiển thị đúng cột Phase, Done, Late, Dates, Result và số Late đúng với guest-overview-normal.json', () => {
    const model = buildGuestReport(normalOverview.report!)
    const onOpenPhase = vi.fn()

    const { container } = render(<PhaseScorecard model={model} onOpenPhase={onOpenPhase} />)

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())
    expect(headers).toEqual(['Phase', 'Done', 'Late', 'Dates', 'Result'])

    // Không còn thanh tiến độ hay mini-Gantt
    expect(container.querySelector('.bg-emerald-400')).toBeNull()

    const phasesWithTasks = model.phases.filter((p) => p.tasks.length > 0)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(phasesWithTasks.length)

    phasesWithTasks.forEach((ph, idx) => {
      const cells = within(rows[idx]).getAllByRole('cell')
      expect(cells[0].textContent).toContain(ph.name)
      expect(cells[0].textContent).toContain(`${ph.tasks.length} task`)
      expect(cells[1].textContent?.trim()).toBe(`${ph.done}/${ph.tasks.length}`)

      const expectedLate = ph.late + ph.overdue
      expect(cells[2].textContent?.trim()).toBe(String(expectedLate))
      expect(cells[2].getAttribute('title')).toBe('Overdue now + finished late')
      if (expectedLate > 0) {
        expect(cells[2].className).toContain('text-rose-600')
        expect(cells[2].className).toContain('font-bold')
      } else {
        expect(cells[2].className).toContain('text-slate-400')
      }

      expect(cells[4].textContent).toContain(ph.verdict.label)
    })

    // Có ít nhất 1 phase trễ (Design: 1 late + 1 overdue = 2) và 1 phase 0 trễ
    expect(phasesWithTasks.some((p) => p.late + p.overdue > 0)).toBe(true)
    expect(phasesWithTasks.some((p) => p.late + p.overdue === 0)).toBe(true)

    expect(
      screen.getByText(
        'Planned end = due date of the latest task in the phase. Late tasks are counted separately and listed in Deadlines.',
      ),
    ).toBeDefined()

    // Bấm cả dòng gọi onOpenPhase với đúng phase.id
    fireEvent.click(rows[0])
    expect(onOpenPhase).toHaveBeenCalledWith(phasesWithTasks[0].id)
  })
})
