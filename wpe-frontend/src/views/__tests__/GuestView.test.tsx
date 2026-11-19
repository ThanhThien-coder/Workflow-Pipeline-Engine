// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { GuestAiSummaryDto, GuestOverviewDto } from '../../types/guest.types'

const overview: GuestOverviewDto = {
  projectName: 'Demo Project',
  phaseLabel: 'Design',
  lastUpdated: '2026-11-19T01:00:00.000Z',
  totalNodes: 5,
  criticalNodes: 2,
  completedNodes: 2,
  completionPct: 40,
  overdueCount: 0,
  blockingCount: 1,
  totalTasks: 5,
  velocity: [{ day: 'Mon', value: 1 }],
  statusBreakdown: [{ key: 'done', label: 'Done', count: 2 }],
  recentActivity: [],
  phases: [
    { name: 'Design', status: 'COMPLETED', progressPct: 100, totalTasks: 2, doneTasks: 2 },
    { name: 'Build', status: 'IN_PROGRESS', progressPct: 33, totalTasks: 3, doneTasks: 1 },
  ],
  memberCount: 4,
}

const ai: GuestAiSummaryDto = {
  content: 'Project health: stable green.',
  highlights: ['Keep the pace'],
  risks: ['WPE-2: Too slow'],
  generatedAt: '2026-11-19T01:00:00.000Z',
}

const svc = vi.hoisted(() => ({
  features: { aiSummary: true, evaluation: false } as { aiSummary: boolean; evaluation: boolean },
  getLinkInfo: vi.fn(),
  getOverview: vi.fn(),
  getAiSummary: vi.fn(),
  listFeedback: vi.fn(),
  createSession: vi.fn(),
  submitFeedback: vi.fn(),
  generateAiReport: vi.fn(),
  getMyEvaluation: vi.fn(),
  submitEvaluation: vi.fn(),
}))

vi.mock('../../services/container', () => ({ guestService: svc }))
vi.mock('../../router/useRouter', () => ({
  useRouter: () => ({ searchParams: new URLSearchParams('token=t1') }),
  navigate: vi.fn(),
}))

import { GuestView, PhasesCard } from '../GuestView'

describe('GuestView (S08)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('wpe_guest_session:t1', JSON.stringify({ sessionId: 's1', displayName: null }))
    svc.features = { aiSummary: true, evaluation: false }
    svc.getLinkInfo.mockResolvedValue({ projectName: 'Demo Project', ownerName: '' })
    svc.getOverview.mockResolvedValue(overview)
    svc.getAiSummary.mockResolvedValue(ai)
    svc.listFeedback.mockResolvedValue([])
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('hiện khối Phases, số thành viên và AI Summary; không có Evaluation', async () => {
    render(<GuestView />)
    await waitFor(() => expect(screen.getAllByTestId('guest-phase')).toHaveLength(2))
    expect(screen.getByText('Phases')).toBeTruthy()
    expect(screen.getByText('Build')).toBeTruthy()
    expect(screen.getByText('33%')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText(/4 members/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Project health: stable green.')).toBeTruthy())
    expect(screen.getByText(/Keep the pace/)).toBeTruthy()
    expect(screen.getByText(/WPE-2: Too slow/)).toBeTruthy()
    expect(screen.queryByText('Evaluation')).toBeNull()
    // bản gọi API thật không có API báo cáo AI nên không hiện nút tạo báo cáo
    expect(screen.queryByText('Generate AI report')).toBeNull()
  })

  it('AI summary 404 -> hiện "No AI analysis yet", trang vẫn hiện phần còn lại', async () => {
    svc.getAiSummary.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }))
    render(<GuestView />)
    await waitFor(() => expect(screen.getByText('No AI analysis yet')).toBeTruthy())
    expect(screen.getAllByTestId('guest-phase')).toHaveLength(2)
  })

  it('backend cũ không trả phases/memberCount -> không hiện khối Phases, không lỗi', async () => {
    svc.getOverview.mockResolvedValue({ ...overview, phases: undefined, memberCount: undefined })
    render(<GuestView />)
    await waitFor(() => expect(screen.getByText('Total Nodes')).toBeTruthy())
    expect(screen.queryByText('Phases')).toBeNull()
    expect(screen.queryByText(/members?$/)).toBeNull()
  })

  it('PhasesCard render từng phase với nhãn trạng thái và thanh tiến độ', () => {
    render(<PhasesCard phases={[{ name: 'Setup', status: 'LOCKED', progressPct: 0, totalTasks: 0, doneTasks: 0 }]} />)
    expect(screen.getByText('Setup')).toBeTruthy()
    expect(screen.getByText('Locked')).toBeTruthy()
    expect(screen.getByText('0%')).toBeTruthy()
  })
})
