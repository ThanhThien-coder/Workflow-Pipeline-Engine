// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import doneOverviewJson from '../../../domain/__fixtures__/guest-overview-done.json'
import normalAiJson from '../../../domain/__fixtures__/guest-ai-normal.json'
import { buildGuestReport } from '../../../domain/guestReport'
import type { GuestAiSummaryDto, GuestOverviewDto } from '../../../types/guest.types'
import type { GuestPhaseExplorerProps } from '../GuestPhaseExplorer'

const mocks = vi.hoisted(() => ({
  fetchGuestOverview: vi.fn(),
  fetchGuestAiSummary: vi.fn(),
  submitGuestFeedback: vi.fn(),
  explorerCalls: [] as GuestPhaseExplorerProps[],
}))

vi.mock('../../../services/impl/http/guest', () => ({
  fetchGuestOverview: (...args: unknown[]) => mocks.fetchGuestOverview(...args),
  fetchGuestAiSummary: (...args: unknown[]) => mocks.fetchGuestAiSummary(...args),
  submitGuestFeedback: (...args: unknown[]) => mocks.submitGuestFeedback(...args),
}))

vi.mock('../GuestPhaseExplorer', () => ({
  GuestPhaseExplorer: (props: GuestPhaseExplorerProps) => {
    mocks.explorerCalls.push(props)
    return (
      <div
        data-testid="guest-phase-explorer"
        data-selected-phase={props.selectedPhaseId ?? ''}
        data-focus-task={props.focusTaskId ?? ''}
      />
    )
  },
}))

import { GuestReportView } from '../GuestReportView'

const normalOverview = normalOverviewJson as unknown as GuestOverviewDto
const doneOverview = doneOverviewJson as unknown as GuestOverviewDto
const normalAi = normalAiJson as unknown as GuestAiSummaryDto

describe('GuestReportView', () => {
  beforeEach(() => {
    mocks.fetchGuestOverview.mockReset()
    mocks.fetchGuestAiSummary.mockReset()
    mocks.submitGuestFeedback.mockReset()
    mocks.explorerCalls.length = 0
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('với guest-overview-normal.json hiện đúng tên dự án, 4 KPI theo buildGuestReport và nội dung AI', async () => {
    mocks.fetchGuestAiSummary.mockResolvedValue(normalAi)
    const model = buildGuestReport(normalOverview.report!)
    const expectedOnTimePct = Math.round((model.metrics.onTime / model.metrics.onTimeBase) * 100)

    render(<GuestReportView token="tok-normal" overview={normalOverview} />)

    const overviewSection = document.getElementById('s-overview')!
    const overviewScope = within(overviewSection)

    expect(overviewScope.getByRole('heading', { level: 1, name: model.project.name })).toBeTruthy()

    const completionCard = overviewScope.getByText('Completion').closest('div')!.parentElement!
    expect(within(completionCard).getByText(`${model.metrics.pct}% of tasks done`)).toBeTruthy()
    expect(completionCard.textContent).toContain(`${model.metrics.done}/${model.metrics.total}`)

    const onTimeCard = overviewScope.getByText('On time').closest('div')!.parentElement!
    expect(within(onTimeCard).getByText(`${expectedOnTimePct}%`)).toBeTruthy()
    expect(
      within(onTimeCard).getByText(
        `${model.metrics.onTime} of ${model.metrics.onTimeBase} tasks that reached their due date were done in time`,
      ),
    ).toBeTruthy()

    const missedCard = overviewScope.getByText('Missed deadlines').closest('button')!
    expect(within(missedCard).getByText(String(model.metrics.missed))).toBeTruthy()
    expect(within(missedCard).getByText(`${model.metrics.overdue.length} overdue now`)).toBeTruthy()
    expect(within(missedCard).getByText(`${model.metrics.lateDone.length} finished late`)).toBeTruthy()

    const deliverablesCard = overviewScope.getByText('Deliverables').closest('div')!.parentElement!
    expect(within(deliverablesCard).getByText(String(model.artifacts.length))).toBeTruthy()
    expect(within(deliverablesCard).getByText('shared with reviewers')).toBeTruthy()

    await waitFor(() => expect(screen.getByText(normalAi.content)).toBeTruthy())
    expect(mocks.fetchGuestAiSummary).toHaveBeenCalledWith('tok-normal')

    // Phase mặc định của dự án đang chạy là phase hiện tại
    const explorer = screen.getByTestId('guest-phase-explorer')
    expect(explorer.getAttribute('data-selected-phase')).toBe(model.metrics.currentPhase?.id)
  })

  it('với guest-overview-done.json, tab "Finished late" có đúng 7 dòng và chọn phase trễ nhiều nhất', async () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    const model = buildGuestReport(doneOverview.report!)
    const mostLatePhase = model.phases
      .filter((p) => p.index >= 0)
      .reduce((best, p) => (p.late > best.late ? p : best))

    render(<GuestReportView token="tok-done" overview={doneOverview} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Online Bookstore' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finished late (7)' })).toBeTruthy()
    expect(screen.getAllByTestId('deadline-row-late')).toHaveLength(7)

    const explorer = screen.getByTestId('guest-phase-explorer')
    expect(explorer.getAttribute('data-selected-phase')).toBe(mostLatePhase.id)
  })

  it('gửi góp ý phạm vi phase thì content có tiền tố [Phase N · tên] và nodeId là null', async () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))
    mocks.submitGuestFeedback.mockResolvedValue({
      id: 'fb-1',
      author: 'Dr. Tran',
      message: '[Phase 2 · Design] Clean class diagram',
      createdAt: '2026-11-20T09:00:00.000Z',
    })

    render(<GuestReportView token="tok-fb" overview={normalOverview} />)

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dr. Tran' } })
    fireEvent.change(screen.getByLabelText('Feedback scope'), { target: { value: 'p:102' } })
    fireEvent.change(screen.getByLabelText('Feedback content'), { target: { value: 'Clean class diagram' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => expect(screen.getByText(/Sent\./)).toBeTruthy())
    expect(mocks.submitGuestFeedback).toHaveBeenCalledTimes(1)
    expect(mocks.submitGuestFeedback).toHaveBeenCalledWith('tok-fb', {
      reviewerName: 'Dr. Tran',
      reviewerRole: 'GUEST',
      content: '[Phase 2 · Design] Clean class diagram',
      nodeId: null,
    })
  })

  it('bật Anonymous không nhập tên vẫn gửi được với reviewerName là Anonymous và giữ lại tên đã gõ khi tắt', async () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))
    mocks.submitGuestFeedback.mockResolvedValue({
      id: 'fb-anon',
      author: 'Anonymous',
      message: 'Looks good overall',
      createdAt: '2026-11-20T09:00:00.000Z',
    })

    render(<GuestReportView token="tok-anon" overview={normalOverview} />)

    const nameInput = screen.getByLabelText('Your name') as HTMLInputElement
    const anonCheckbox = screen.getByLabelText('Anonymous') as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: 'Dr. Tran' } })
    fireEvent.click(anonCheckbox)

    expect(nameInput.disabled).toBe(true)
    expect(nameInput.placeholder).toBe('Sent without a name')

    fireEvent.change(screen.getByLabelText('Feedback content'), { target: { value: 'Looks good overall' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => expect(screen.getByText(/Sent\./)).toBeTruthy())
    expect(mocks.submitGuestFeedback).toHaveBeenCalledWith('tok-anon', {
      reviewerName: 'Anonymous',
      reviewerRole: 'GUEST',
      content: 'Looks good overall',
      nodeId: null,
    })

    fireEvent.click(anonCheckbox)
    expect(nameInput.disabled).toBe(false)
    expect(nameInput.value).toBe('Dr. Tran')
  })

  it('tắt Anonymous mà không nhập tên thì hiện lỗi và không gọi submitGuestFeedback', () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))

    render(<GuestReportView token="tok-noname" overview={normalOverview} />)

    fireEvent.change(screen.getByLabelText('Feedback content'), { target: { value: 'Missing name test' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    expect(
      screen.getByText('Please enter your name so the team knows who wrote this, or tick Anonymous.'),
    ).toBeTruthy()
    expect(mocks.submitGuestFeedback).not.toHaveBeenCalled()
  })

  it('gửi góp ý thất bại thì hiện câu lỗi backend trả về', async () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))
    mocks.submitGuestFeedback.mockRejectedValue(new Error('Rate limit exceeded for this project'))

    render(<GuestReportView token="tok-err" overview={normalOverview} />)

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Dr. Tran' } })
    fireEvent.change(screen.getByLabelText('Feedback content'), { target: { value: 'Needs unit tests' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => expect(screen.getByText('Rate limit exceeded for this project')).toBeTruthy())
  })

  it('AI lỗi thì ẩn khối AI nhưng trang vẫn hiện bình thường', async () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('AI unavailable'))

    render(<GuestReportView token="tok-no-ai" overview={normalOverview} />)

    await waitFor(() => expect(mocks.fetchGuestAiSummary).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('AI summary')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Library Management System' })).toBeTruthy()
    expect(screen.getByText('Who did what')).toBeTruthy()
    expect(screen.getByText('Send feedback')).toBeTruthy()
  })

  it('dự án DRAFT hiện "Not started", không hiện "Active" hay nhãn sức khỏe', () => {
    const draft = {
      ...normalOverview,
      report: { ...normalOverview.report!, project: { ...normalOverview.report!.project, status: 'DRAFT' } },
    } as GuestOverviewDto
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('no AI'))
    render(<GuestReportView token="tok-draft" overview={draft} />)
    expect(screen.getByText('Not started', { selector: 'h1 ~ span' })).toBeTruthy()
    expect(screen.queryByText('Active', { selector: 'h1 ~ span' })).toBeNull()
    expect(screen.queryByText(/At risk ·/)).toBeNull()
  })

  it('nút Graph trong Deadlines cập nhật selectedPhaseId và focusTaskId cho GuestPhaseExplorer', () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))

    render(<GuestReportView token="tok-nav" overview={normalOverview} />)

    const graphButtons = screen.getAllByRole('button', { name: 'Graph' })
    fireEvent.click(graphButtons[0])

    const explorer = screen.getByTestId('guest-phase-explorer')
    expect(explorer.getAttribute('data-focus-task')).toBeTruthy()
    expect(explorer.getAttribute('data-selected-phase')).toBeTruthy()
  })

  it('artifact có url null chỉ hiện chữ không gắn link; url hợp lệ có target=_blank và rel=noopener noreferrer', () => {
    mocks.fetchGuestAiSummary.mockRejectedValue(new Error('404'))
    const overviewWithNullUrl: GuestOverviewDto = {
      ...normalOverview,
      report: {
        ...normalOverview.report!,
        artifacts: [
          {
            id: 'art-unsafe',
            name: 'Unsafe javascript link',
            type: 'OTHER_LINK',
            url: 'javascript:alert(1)',
            nodeId: '5002',
            createdAt: '2026-11-19T05:00:00.000Z',
          },
          {
            id: 'art-safe',
            name: 'Valid PR link',
            type: 'PR',
            url: 'https://github.com/team/repo/pull/42',
            nodeId: '5011',
            createdAt: '2026-11-18T05:00:00.000Z',
          },
        ],
      },
    }

    render(<GuestReportView token="tok-art" overview={overviewWithNullUrl} />)

    const unsafeText = screen.getByText('Unsafe javascript link')
    expect(unsafeText.tagName).toBe('SPAN')
    expect(unsafeText.closest('a')).toBeNull()

    const safeLink = screen.getByRole('link', { name: 'Valid PR link' })
    expect(safeLink.getAttribute('href')).toBe('https://github.com/team/repo/pull/42')
    expect(safeLink.getAttribute('target')).toBe('_blank')
    expect(safeLink.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
