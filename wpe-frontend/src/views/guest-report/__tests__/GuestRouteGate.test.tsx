// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import normalOverviewJson from '../../../domain/__fixtures__/guest-overview-normal.json'
import type { GuestOverviewDto } from '../../../types/guest.types'

const hoisted = vi.hoisted(() => ({
  enabled: true,
  search: 'token=tok-1',
  shouldCrashReport: false,
  fetchGuestOverview: vi.fn(),
  fetchGuestAiSummary: vi.fn(),
  submitGuestFeedback: vi.fn(),
}))

vi.mock('../flag', () => ({
  get GUEST_REPORT_ENABLED() {
    return hoisted.enabled
  },
}))

vi.mock('../../../router/useRouter', () => ({
  useRouter: () => ({ searchParams: new URLSearchParams(hoisted.search) }),
}))

vi.mock('../../../services/impl/http/guest', () => ({
  fetchGuestOverview: (...args: unknown[]) => hoisted.fetchGuestOverview(...args),
  fetchGuestAiSummary: (...args: unknown[]) => hoisted.fetchGuestAiSummary(...args),
  submitGuestFeedback: (...args: unknown[]) => hoisted.submitGuestFeedback(...args),
}))

vi.mock('../../GuestView', () => ({
  default: () => <div data-testid="legacy-guest-view">Legacy GuestView</div>,
  GuestView: () => <div data-testid="legacy-guest-view">Legacy GuestView</div>,
}))

vi.mock('../GuestReportView', () => ({
  GuestReportView: ({ overview }: { token: string; overview: GuestOverviewDto }) => {
    if (hoisted.shouldCrashReport) {
      throw new Error('Simulated crash in GuestReportView')
    }
    return <div data-testid="new-guest-report-view">{overview.report?.project.name}</div>
  },
}))

import { GuestRouteGate } from '../GuestRouteGate'
import { GuestReportErrorBoundary } from '../GuestReportErrorBoundary'

const normalOverview = normalOverviewJson as unknown as GuestOverviewDto

describe('GuestRouteGate', () => {
  beforeEach(() => {
    hoisted.enabled = true
    hoisted.search = 'token=tok-1'
    hoisted.shouldCrashReport = false
    hoisted.fetchGuestOverview.mockReset()
    hoisted.fetchGuestAiSummary.mockReset()
    hoisted.submitGuestFeedback.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('GUEST_REPORT_ENABLED là false thì render GuestView và không fetch overview', () => {
    hoisted.enabled = false
    render(<GuestRouteGate />)
    expect(screen.getByTestId('legacy-guest-view')).toBeTruthy()
    expect(hoisted.fetchGuestOverview).not.toHaveBeenCalled()
  })

  it('không có token thì render GuestView và không fetch overview', () => {
    hoisted.search = ''
    render(<GuestRouteGate />)
    expect(screen.getByTestId('legacy-guest-view')).toBeTruthy()
    expect(hoisted.fetchGuestOverview).not.toHaveBeenCalled()
  })

  it('report là null thì quay về GuestView và chỉ fetch đúng 1 lần', async () => {
    hoisted.fetchGuestOverview.mockResolvedValue({ ...normalOverview, report: null })
    render(<GuestRouteGate />)
    await waitFor(() => expect(screen.getByTestId('legacy-guest-view')).toBeTruthy())
    expect(hoisted.fetchGuestOverview).toHaveBeenCalledTimes(1)
    expect(hoisted.fetchGuestOverview).toHaveBeenCalledWith('tok-1')
  })

  it('fetch lỗi thì quay về GuestView và chỉ fetch đúng 1 lần', async () => {
    hoisted.fetchGuestOverview.mockRejectedValue(new Error('Network error'))
    render(<GuestRouteGate />)
    await waitFor(() => expect(screen.getByTestId('legacy-guest-view')).toBeTruthy())
    expect(hoisted.fetchGuestOverview).toHaveBeenCalledTimes(1)
  })

  it('có report thì render trang khách mới và chỉ fetch đúng 1 lần', async () => {
    hoisted.fetchGuestOverview.mockResolvedValue(normalOverview)
    render(<GuestRouteGate />)
    await waitFor(() => expect(screen.getByTestId('new-guest-report-view')).toBeTruthy())
    expect(screen.getByText('Library Management System')).toBeTruthy()
    expect(hoisted.fetchGuestOverview).toHaveBeenCalledTimes(1)
  })

  it('ErrorBoundary bắt lỗi trong GuestReportView thì quay về GuestView', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hoisted.shouldCrashReport = true
    hoisted.fetchGuestOverview.mockResolvedValue(normalOverview)
    render(<GuestRouteGate />)
    await waitFor(() => expect(screen.getByTestId('legacy-guest-view')).toBeTruthy())
    expect(hoisted.fetchGuestOverview).toHaveBeenCalledTimes(1)
  })

  it('GuestReportErrorBoundary gọi onError và render fallback khi con ném lỗi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const Boom = () => {
      throw new Error('boom')
    }
    render(
      <GuestReportErrorBoundary fallback={<div data-testid="eb-fallback">Fallback</div>} onError={onError}>
        <Boom />
      </GuestReportErrorBoundary>,
    )
    expect(screen.getByTestId('eb-fallback')).toBeTruthy()
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
