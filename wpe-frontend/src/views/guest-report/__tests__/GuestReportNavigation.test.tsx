// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import type { GuestOverviewDto } from '../../../types/guest.types'

const mocks = vi.hoisted(() => ({
  fetchGuestAiSummary: vi.fn(),
  submitGuestFeedback: vi.fn(),
}))

vi.mock('../../../services/impl/http/guest', () => ({
  fetchGuestAiSummary: (...args: unknown[]) => mocks.fetchGuestAiSummary(...args),
  submitGuestFeedback: (...args: unknown[]) => mocks.submitGuestFeedback(...args),
}))

import { GuestReportView } from '../GuestReportView'

const normalOverview = normalOverviewJson as unknown as GuestOverviewDto

describe('GuestReportView — nhảy tới task, góp ý và các trường hợp biên', () => {
  beforeEach(() => {
    mocks.fetchGuestAiSummary.mockReset().mockRejectedValue(new Error('no ai'))
    mocks.submitGuestFeedback.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('bấm "Graph" 2 lần vào cùng một task thì lần 2 vẫn gọi cuộn (scrollIntoView)', async () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    render(<GuestReportView token="tok-nav-2" overview={normalOverview} />)

    const graphButtons = screen.getAllByRole('button', { name: 'Graph' })
    fireEvent.click(graphButtons[0])

    await waitFor(() => expect(scrollSpy).toHaveBeenCalledTimes(1))

    // Chọn task khác trên đồ thị để mô phỏng người dùng xem task khác rồi bấm lại Graph cho task cũ
    const graphPanel = screen.getByTestId('guest-task-graph-panel')
    const nodeCards = graphPanel.querySelectorAll<HTMLButtonElement>('[data-graph-node-id]')
    const anotherNode = Array.from(nodeCards).find((el) => !el.getAttribute('data-ghost'))
    if (anotherNode) {
      fireEvent.click(anotherNode)
    }

    scrollSpy.mockClear()
    fireEvent.click(graphButtons[0])

    await waitFor(() => expect(scrollSpy).toHaveBeenCalledTimes(1))
  })

  it('khi có task không phase: dropdown góp ý có option p:none và FeedbackSection trừ độ dài tiền tố phase + tăng tổng sau gửi', async () => {
    mocks.submitGuestFeedback.mockResolvedValue({
      id: 'fb-new',
      author: 'Dr. Tran',
      message: 'Looks good',
      createdAt: '2026-11-20T09:00:00.000Z',
    })

    const withUnphased: GuestOverviewDto = {
      ...normalOverview,
      report: {
        ...normalOverview.report!,
        feedback: { total: 0, resolved: 0 },
        graph: {
          ...normalOverview.report!.graph,
          nodes: [
            ...(normalOverview.report!.graph.nodes ?? []),
            {
              id: '5999',
              phaseId: null,
              code: 'WPE-99',
              title: 'Unphased cleanup',
              status: 'TODO',
              createdAt: '2026-11-10T05:00:00.000Z',
            },
          ],
        },
      },
    }

    render(<GuestReportView token="tok-fb-edge" overview={withUnphased} />)

    const scopeSelect = screen.getByLabelText('Feedback scope') as HTMLSelectElement
    const noPhaseOption = within(scopeSelect).getByRole('option', { name: 'Tasks without a phase' }) as HTMLOptionElement
    expect(noPhaseOption.value).toBe('p:none')

    // Chọn Phase 2 · Design -> maxLength và bộ đếm phải trừ độ dài "[Phase 2 · Design] " (19 ký tự)
    fireEvent.change(scopeSelect, { target: { value: 'p:102' } })
    const textarea = screen.getByLabelText('Feedback content') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(2000 - '[Phase 2 · Design] '.length)
    expect(screen.getByText(`0/${2000 - '[Phase 2 · Design] '.length}`)).toBeTruthy()

    // Chọn nhóm No phase -> gửi feedback thành công thì cập nhật "0 of 1", không còn "No feedback received yet"
    fireEvent.change(scopeSelect, { target: { value: 'p:none' } })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dr. Tran' } })
    fireEvent.change(textarea, { target: { value: 'Check unphased tasks' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => expect(screen.getByText(/Sent\./)).toBeTruthy())
    expect(screen.queryByText(/No feedback received yet/)).toBeNull()
    expect(screen.getByText('0 of 1')).toBeTruthy()
  })
})
