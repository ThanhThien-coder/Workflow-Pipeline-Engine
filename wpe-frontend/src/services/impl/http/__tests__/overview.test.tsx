// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { create } from 'zustand'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'
import { MockWorkflowService } from '../../../MockWorkflowService'
import { computeOverviewStats, computeWeeklyVelocity, mapAiAnalysisToReport } from '../overview'
import { WeeklyVelocityCard } from '../../../../components/overview/WeeklyVelocityCard'
import { createOverviewSlice, type OverviewSlice } from '../../../../store/slices/overviewSlice'
import { GuestAccessPopover } from '../../../../components/popovers/GuestAccessPopover'
import { AiDiagnosisPopover } from '../../../../components/popovers/AiDiagnosisPopover'
import { OverviewView } from '../../../../components/views/OverviewView'
import { useWorkflowStore } from '../../../../store/useWorkflowStore'
import { ApiError } from '../../../http/ApiError'
import type { IWorkflowService } from '../../../contracts/IWorkflowService'
import type { AiDiagnosticReport, OverviewData } from '../../../../types/overview.types'

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined || body === null) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Call = { method: string; url: string; body: unknown }

describe('FC2 — Overview dự án dùng dữ liệu thật & link khách theo projectId route', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    useWorkflowStore.getState().overview.reset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getOverviewData không còn nằm trong METHODS_STILL_MOCKED', () => {
    const list: readonly string[] = METHODS_STILL_MOCKED
    expect(list).not.toContain('getOverviewData')
  })

  it("getOverviewData('5') trả project.id === '5' và tên thật; không gọi mock.getOverviewData", async () => {
    localStorage.setItem('wpe_auth_user', JSON.stringify({ id: 10, username: 'alex' }))
    const mockSpy = vi.spyOn(MockWorkflowService.prototype, 'getOverviewData')

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const urlStr = String(url)
      calls.push({
        method,
        url: urlStr,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })

      if (method === 'GET' && urlStr.endsWith('/projects/5')) {
        return jsonResponse(200, {
          id: 5,
          name: 'Real Fintech Pipeline',
          description: 'Dự án thật số 5',
          status: 'ACTIVE',
          ownerId: 10,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-12T10:00:00Z',
        })
      }
      if (method === 'GET' && urlStr.endsWith('/projects/5/graph')) {
        return jsonResponse(200, {
          phases: [{ id: 1, name: 'Phase 1' }],
          phaseEdges: [],
          nodes: [
            { id: 1, code: 'WPE-001', title: 'Task 1', status: 'DONE' },
            { id: 2, code: 'WPE-002', title: 'Task 2', status: 'DONE' },
            { id: 3, code: 'WPE-003', title: 'Task 3', status: 'IN_PROGRESS', dueDate: '2020-01-01T00:00:00Z' },
            { id: 4, code: 'WPE-004', title: 'Task 4', status: 'REVIEW' },
          ],
          dependencies: [{ parentNodeId: 3, childNodeId: 4 }],
        })
      }
      if (method === 'GET' && urlStr.includes('/projects/5/activity')) {
        return jsonResponse(200, [
          {
            id: 'act-1',
            type: 'TASK_STATUS_CHANGED',
            actorName: 'Alex Kim',
            message: 'Hoàn thành WPE-002',
            targetCode: 'WPE-002',
            createdAt: '2026-11-12T09:00:00Z',
          },
        ])
      }
      if (method === 'GET' && urlStr.endsWith('/projects/5/feedbacks')) {
        return jsonResponse(200, [])
      }
      if (method === 'GET' && urlStr.endsWith('/projects/5/ai-analysis')) {
        return jsonResponse(200, { hasAnalysis: false, message: 'Chưa có chẩn đoán' })
      }
      if (method === 'GET' && urlStr.endsWith('/projects/5/guest-token')) {
        return jsonResponse(200, {
          enabled: true,
          token: 'gst_real_5',
          expiresAt: '2026-12-01T00:00:00Z',
        })
      }
      return jsonResponse(404, { status: 404, error: 'NOT_FOUND' })
    })

    const svc = new HttpWorkflowService()
    const overview = await svc.getOverviewData('5')

    expect(mockSpy).not.toHaveBeenCalled()
    expect(overview.project.id).toBe('5')
    expect(overview.project.name).toBe('Real Fintech Pipeline')
    expect(overview.project.role).toBe('OWNER')
    expect(overview.metrics.totalNodes).toBe(4)
    expect(overview.metrics.completedNodes).toBe(2)
    expect(overview.metrics.completionRate).toBe(50)
    expect(overview.metrics.overdueCount).toBe(1)
    expect(overview.metrics.pendingReviewCount).toBe(1)
    expect(overview.metrics.blockingReleaseCount).toBe(1)
    expect(overview.recentActivity).toHaveLength(1)
    expect(overview.recentActivity[0].actor.name).toBe('Alex Kim')
    expect(overview.aiReport.insights).toEqual([])
    expect(overview.aiReport.hasAnalysis).toBe(false)
    expect(overview.guestAccess.token).toBe('gst_real_5')
    expect(calls.some((c) => c.url.includes('/projects/5/activity?limit=10'))).toBe(true)
  })

  it('computeOverviewStats: đồ thị 4 node (2 DONE, 1 trễ hạn) → 50%, overdue 1; dự án có node thì hasData: true (cột 0 khi thiếu completedAt/updatedAt)', () => {
    const nowMs = Date.parse('2026-11-13T12:00:00Z')
    const stats = computeOverviewStats(
      {
        phases: [],
        phaseEdges: [],
        nodes: [
          { id: '1', code: 'N-1', title: 'A', status: 'DONE' },
          { id: '2', code: 'N-2', title: 'B', status: 'DONE' },
          { id: '3', code: 'N-3', title: 'C', status: 'IN_PROGRESS', dueDate: '2026-11-10T00:00:00Z' },
          { id: '4', code: 'N-4', title: 'D', status: 'TODO', dueDate: '2026-11-20T00:00:00Z' },
        ],
        dependencies: [
          { parentNodeId: '1', childNodeId: '3' },
          { parentNodeId: '3', childNodeId: '4' },
        ],
      },
      nowMs,
    )

    expect(stats.metrics.totalNodes).toBe(4)
    expect(stats.metrics.completedNodes).toBe(2)
    expect(stats.metrics.completionRate).toBe(50)
    expect(stats.metrics.overdueCount).toBe(1)
    expect(stats.metrics.criticalPathNodes).toBe(3)
    expect(stats.velocity.hasData).toBe(true)
    expect(stats.velocity.days).toHaveLength(7)
    expect(stats.velocity.days.every((d) => d.tasks === 0)).toBe(true)
  })

  it('computeOverviewStats: tính Weekly Velocity 7 ngày khi node có updatedAt', () => {
    const nowMs = Date.parse('2026-11-13T12:00:00Z')
    const stats = computeOverviewStats(
      {
        nodes: [
          { id: '1', code: 'N-1', title: 'A', status: 'DONE', updatedAt: '2026-11-13T08:00:00Z' },
          { id: '2', code: 'N-2', title: 'B', status: 'DONE', updatedAt: '2026-11-13T09:00:00Z' },
          { id: '3', code: 'N-3', title: 'C', status: 'DONE', updatedAt: '2026-11-12T10:00:00Z' },
          { id: '4', code: 'N-4', title: 'D', status: 'IN_PROGRESS', isOverdue: true },
        ],
        dependencies: [],
      },
      nowMs,
    )

    expect(stats.velocity.hasData).toBe(true)
    expect(stats.velocity.days).toHaveLength(7)
    expect(stats.velocity.days[6].tasks).toBe(2)
    expect(stats.velocity.days[6].isPeak).toBe(true)
    expect(stats.velocity.days[5].tasks).toBe(1)
    expect(stats.metrics.overdueCount).toBe(1)
  })

  it('getOverviewData khi API chính (graph) lỗi → ném ApiError, không rơi về mock; lỗi ai-analysis → trả trạng thái rỗng', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const urlStr = String(url)
      if (urlStr.endsWith('/projects/5')) {
        return jsonResponse(200, { id: 5, name: 'Real 5', status: 'ACTIVE', ownerId: 1 })
      }
      if (urlStr.endsWith('/projects/5/graph')) {
        return jsonResponse(500, { status: 500, error: 'INTERNAL_ERROR', message: 'Lỗi tải đồ thị' })
      }
      if (urlStr.includes('/projects/5/activity')) return jsonResponse(200, [])
      if (urlStr.endsWith('/projects/5/feedbacks')) return jsonResponse(200, [])
      if (urlStr.endsWith('/projects/5/ai-analysis')) return jsonResponse(500, { status: 500 })
      if (urlStr.endsWith('/projects/5/guest-token')) return jsonResponse(200, { enabled: false })
      return jsonResponse(404)
    })

    const svc = new HttpWorkflowService()
    await expect(svc.getOverviewData('5')).rejects.toMatchObject({ status: 500 })

    const emptyReport = mapAiAnalysisToReport(null, '2026-11-13T10:00:00Z')
    expect(emptyReport.hasAnalysis).toBe(false)
    expect(emptyReport.insights).toEqual([])
    expect(emptyReport.emptyMessage).toBe('No diagnosis yet')
  })

  it('overviewSlice: generateGuest gọi API với projectId của route (không dùng id mock "1") và toast hiện message backend', async () => {
    const generateSpy = vi.fn().mockResolvedValue({
      isActive: true,
      token: 'gst_route_5',
      expiresAt: '2026-12-01T00:00:00Z',
      expiresLabel: '2026-12-01',
    })
    const revokeSpy = vi.fn().mockResolvedValue({
      isActive: false,
      token: '',
      expiresAt: '',
      expiresLabel: 'Đã thu hồi',
    })
    const resolveSpy = vi.fn().mockResolvedValue(undefined)

    const fakeService = {
      getOverviewData: vi.fn(),
      generateGuestToken: generateSpy,
      toggleGuestAccess: revokeSpy,
      resolveFeedback: resolveSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    // Giả lập data có project.id = '1' (như mock cũ), trong khi route/currentProjectId là '5'
    store.setState((state) => ({
      overview: {
        ...state.overview,
        data: {
          project: { id: '1', name: 'Stale', role: 'OWNER', phaseLabel: 'Draft', lastUpdatedAt: '2026-11-13T00:00:00Z' },
          metrics: { totalNodes: 0, criticalPathNodes: 0, completedNodes: 0, completionRate: 0, overdueCount: 0, blockingReleaseCount: 0, pendingReviewCount: 0 },
          velocity: { periodLabel: 'Last 7 days', days: [], hasData: false },
          statusBreakdown: { totalTasks: 0, items: [] },
          aiReport: { engine: 'Gemini', generatedAt: '2026-11-13T00:00:00Z', insights: [], hasAnalysis: false },
          guestAccess: { isActive: false, token: '', expiresAt: '', expiresLabel: 'Đã thu hồi' },
          feedbackQueue: [],
          recentActivity: [],
        },
      },
    }))

    await store.getState().overview.generateGuest()
    expect(generateSpy).toHaveBeenCalledWith('5')

    await store.getState().overview.revokeGuest()
    expect(revokeSpy).toHaveBeenCalledWith('5', false)

    await store.getState().overview.resolveFeedback('fb-9')
    expect(resolveSpy).toHaveBeenCalledWith('5', 'fb-9')

    // Khi backend trả lỗi 403 → toast hiện đúng message từ backend
    generateSpy.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Chỉ chủ dự án mới tạo được link' }),
    )
    await store.getState().overview.generateGuest('5')
    expect(store.getState().overview.toast).toBe('Chỉ chủ dự án mới tạo được link')
  })

  it('GuestAccessPopover: khi không phải owner (canManage=false) thì nút tạo link bị vô hiệu và có chú thích', () => {
    const onGenerate = vi.fn(async () => {})
    const onRevoke = vi.fn(async () => {})

    render(
      <GuestAccessPopover
        state={{
          isActive: false,
          token: '',
          expiresAt: '',
          expiresLabel: 'Chỉ chủ dự án mới có quyền quản lý link',
        }}
        onGenerate={onGenerate}
        onRevoke={onRevoke}
        notify={vi.fn()}
        canManage={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Guest Link/i }))
    const genBtn = screen.getByRole('button', { name: /Generate New Token/i }) as HTMLButtonElement
    expect(genBtn.disabled).toBe(true)
    expect(screen.getByTestId('guest-owner-only-note').textContent).toContain('Only the project owner')
    fireEvent.click(genBtn)
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it('OverviewView: ẩn card Weekly Velocity khi hasData = false, hiện "No diagnosis yet" khi AI rỗng', () => {
    const sampleData: OverviewData = {
      project: {
        id: '5',
        name: 'Fintech Core',
        role: 'OWNER',
        phaseLabel: '2 phases · Published',
        lastUpdatedAt: '2026-11-13T08:00:00Z',
      },
      metrics: {
        totalNodes: 4,
        criticalPathNodes: 2,
        completedNodes: 2,
        completionRate: 50,
        overdueCount: 1,
        blockingReleaseCount: 1,
        pendingReviewCount: 0,
      },
      velocity: {
        periodLabel: 'Last 7 days',
        days: [],
        hasData: false,
        unavailableNote: 'No tasks yet. The chart will appear once the pipeline has tasks.',
      },
      statusBreakdown: {
        totalTasks: 4,
        items: [
          { status: 'DONE', label: 'Done', percent: 50, taskCount: 2, barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
          { status: 'IN_PROGRESS', label: 'In Progress', percent: 25, taskCount: 1, barClass: 'bg-blue-500', dotClass: 'bg-blue-500' },
          { status: 'TODO', label: 'To Do', percent: 25, taskCount: 1, barClass: 'bg-sky-400', dotClass: 'bg-sky-400' },
          { status: 'LOCKED', label: 'Locked', percent: 0, taskCount: 0, barClass: 'bg-slate-300', dotClass: 'bg-slate-300' },
        ],
      },
      aiReport: {
        engine: 'Gemini',
        generatedAt: '2026-11-13T08:00:00Z',
        insights: [],
        hasAnalysis: false,
        emptyMessage: 'No diagnosis yet',
      },
      guestAccess: { isActive: false, token: '', expiresAt: '', expiresLabel: 'Đã thu hồi' },
      feedbackQueue: [],
      recentActivity: [],
    }

    useWorkflowStore.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        status: 'ready',
        error: null,
        data: sampleData,
      },
    }))

    render(<OverviewView projectId="5" />)

    expect(screen.getByText('Fintech Core')).toBeTruthy()
    expect(screen.getAllByText('50%').some((el) => el.classList.contains('text-4xl'))).toBe(true)
    expect(screen.getByText('2 / 4 nodes completed')).toBeTruthy()
    expect(screen.getByTestId('weekly-velocity-hidden')).toBeTruthy()
    expect(screen.queryByText('Weekly Velocity')).toBeNull()
    expect(screen.getByTestId('ai-diagnosis-empty').textContent).toContain('No diagnosis yet')
    expect(screen.getByTestId('recent-activity-empty')).toBeTruthy()
  })
})

describe('F2 — Chẩn đoán AI ghi đúng nguồn dữ liệu, không ghi dữ liệu giả là Gemini', () => {
  const advice = [{ action: 'Ưu tiên', targetNodeCode: 'WPE-002', instruction: 'Duyệt WPE-002 sớm', priority: 'HIGH' }]

  function openPopover(raw: Record<string, unknown>) {
    const report = mapAiAnalysisToReport({ analyzedAt: '2026-11-16T08:00:00Z', actionableAdvice: advice, ...raw }, '2026-11-16T09:00:00Z')
    render(<AiDiagnosisPopover report={report} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    return report
  }

  afterEach(() => cleanup())

  it('source = AI_SERVICE → nhãn "Model: Gemini Engine", không có cảnh báo', () => {
    const report = openPopover({ source: 'AI_SERVICE' })

    expect(report.engine).toBe('Gemini')
    expect(report.source).toBe('AI_SERVICE')
    expect(report.warning).toBeUndefined()
    expect(screen.getByText(/Model: Gemini Engine/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('source = MOCK_FALLBACK có warning → nhãn "Sample data" (không phải Gemini) và hiện dòng cảnh báo', () => {
    const warning = 'Không gọi được dịch vụ AI (Connection refused), đang hiển thị dữ liệu giả.'
    const report = openPopover({ source: 'MOCK_FALLBACK', warning })

    expect(report.engine).toBe('Sample data')
    expect(screen.queryByText(/Gemini/)).toBeNull()
    expect(screen.getByText(/Source: Sample data/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain(warning)
  })

  it('source = HEURISTIC_FALLBACK có rateLimitWarning → nhãn "Fallback analysis" và hiện cảnh báo', () => {
    const report = openPopover({ source: 'HEURISTIC_FALLBACK', rateLimitWarning: 'Gemini đang bị giới hạn lượt gọi (429).' })

    expect(report.engine).toBe('Fallback analysis')
    expect(screen.getByText(/Source: Fallback analysis/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('giới hạn lượt gọi (429)')
  })

  it('MOCK, thiếu source, rateLimitWarning = true: không bao giờ mặc định là Gemini; gộp cả 2 cảnh báo', () => {
    expect(mapAiAnalysisToReport({ source: 'MOCK', actionableAdvice: advice }, 't').engine).toBe('Sample data')
    const noSource = mapAiAnalysisToReport({ actionableAdvice: advice }, 't')
    expect(noSource.engine).toBe('Unknown source')
    expect(noSource.source).toBe('UNKNOWN')

    const both = mapAiAnalysisToReport({ source: 'MOCK_FALLBACK', warning: 'W1', rateLimitWarning: true, actionableAdvice: advice }, 't')
    expect(both.warning).toContain('W1')
    expect(both.warning).toContain('The AI service is rate-limited')
  })
})

describe('mapAiAnalysisToReport metrics', () => {
  it('metrics dạng mới { status: "OVERDUE", driftScore: null, completedLast7Days: 2, overdueDays: 3, remainingTasks: 4 } → report.metrics đúng từng trường', () => {
    const report = mapAiAnalysisToReport(
      {
        metrics: {
          status: 'OVERDUE',
          driftScore: null,
          completedLast7Days: 2,
          overdueDays: 3,
          remainingTasks: 4,
        },
        actionableAdvice: [{ action: 'SPLIT_NODE', targetNodeCode: 'WPE-002', instruction: 'Split task' }],
      },
      '2026-11-16T10:00:00Z',
    )
    expect(report.metrics).toEqual({
      status: 'OVERDUE',
      driftScore: null,
      completedLast7Days: 2,
      overdueDays: 3,
      remainingTasks: 4,
    })
  })

  it('metrics dạng cũ { targetVelocity: 2, actualVelocity: 1.2, driftScore: 42.5, status: "RED_ALERT" } → status "RED_ALERT", driftScore 42.5, completedLast7Days/overdueDays/remainingTasks = null', () => {
    const report = mapAiAnalysisToReport(
      {
        metrics: {
          targetVelocity: 2,
          actualVelocity: 1.2,
          driftScore: 42.5,
          status: 'RED_ALERT',
        },
        actionableAdvice: [{ action: 'SPLIT_NODE', targetNodeCode: 'WPE-002', instruction: 'Split task' }],
      },
      '2026-11-16T10:00:00Z',
    )
    expect(report.metrics).toEqual({
      status: 'RED_ALERT',
      driftScore: 42.5,
      completedLast7Days: null,
      overdueDays: null,
      remainingTasks: null,
    })
  })

  it('status lạ "PURPLE" → "UNKNOWN"; không có metrics → report.metrics là undefined', () => {
    const reportPurple = mapAiAnalysisToReport(
      {
        metrics: { status: 'PURPLE' },
        actionableAdvice: [{ action: 'SPLIT_NODE', targetNodeCode: 'WPE-002', instruction: 'Split task' }],
      },
      '2026-11-16T10:00:00Z',
    )
    expect(reportPurple.metrics?.status).toBe('UNKNOWN')

    const reportNoMetrics = mapAiAnalysisToReport(
      {
        actionableAdvice: [{ action: 'SPLIT_NODE', targetNodeCode: 'WPE-002', instruction: 'Split task' }],
      },
      '2026-11-16T10:00:00Z',
    )
    expect(reportNoMetrics.metrics).toBeUndefined()
  })
})

describe('AiDiagnosisPopover — metrics, rescan và lỗi scan', () => {
  afterEach(() => cleanup())

  it('OVERDUE (overdueDays 3, remainingTasks 1) → ai-metrics chứa "Overdue by 3 days · 1 task left"', () => {
    const report: AiDiagnosticReport = {
      engine: 'Gemini',
      generatedAt: '2026-11-16T10:00:00Z',
      insights: [],
      metrics: {
        status: 'OVERDUE',
        driftScore: null,
        completedLast7Days: null,
        overdueDays: 3,
        remainingTasks: 1,
      },
    }
    render(<AiDiagnosisPopover report={report} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    const metricsEl = screen.getByTestId('ai-metrics')
    expect(metricsEl.textContent).toContain('Overdue by 3 days · 1 task left')
  })

  it('INSUFFICIENT_DATA → chứa "Not enough data"', () => {
    const report: AiDiagnosticReport = {
      engine: 'Gemini',
      generatedAt: '2026-11-16T10:00:00Z',
      insights: [],
      metrics: {
        status: 'INSUFFICIENT_DATA',
        driftScore: null,
        completedLast7Days: null,
        overdueDays: null,
        remainingTasks: null,
      },
    }
    render(<AiDiagnosisPopover report={report} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    expect(screen.getByTestId('ai-metrics').textContent).toContain('Not enough data')
  })

  it('STABLE_GREEN, driftScore 12.5, completedLast7Days 1 → chứa "On track", "Drift 12.5%", "1 task done in the last 7 days"', () => {
    const report: AiDiagnosticReport = {
      engine: 'Gemini',
      generatedAt: '2026-11-16T10:00:00Z',
      insights: [],
      metrics: {
        status: 'STABLE_GREEN',
        driftScore: 12.5,
        completedLast7Days: 1,
        overdueDays: null,
        remainingTasks: null,
      },
    }
    render(<AiDiagnosisPopover report={report} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    const el = screen.getByTestId('ai-metrics')
    expect(el.textContent).toContain('On track')
    expect(el.textContent).toContain('Drift 12.5%')
    expect(el.textContent).toContain('1 task done in the last 7 days')
  })

  it('bấm "Re-scan Pipeline" gọi onRescan đúng 1 lần; scanning = true → nút bị vô hiệu và hiện "Scanning…"; không truyền onRescan → nút bị vô hiệu', () => {
    const onRescan = vi.fn()
    const report: AiDiagnosticReport = {
      engine: 'Gemini',
      generatedAt: '2026-11-16T10:00:00Z',
      insights: [],
    }

    const { rerender } = render(<AiDiagnosisPopover report={report} onRescan={onRescan} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    const rescanBtn = screen.getByRole('button', { name: /Re-scan Pipeline/i })
    expect((rescanBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(rescanBtn)
    expect(onRescan).toHaveBeenCalledTimes(1)

    rerender(<AiDiagnosisPopover report={report} scanning={true} onRescan={onRescan} />)
    const scanningBtn = screen.getByRole('button', { name: /Scanning…/i })
    expect((scanningBtn as HTMLButtonElement).disabled).toBe(true)

    rerender(<AiDiagnosisPopover report={report} />)
    const disabledBtn = screen.getByRole('button', { name: /Re-scan Pipeline/i })
    expect((disabledBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('scanError = "X" → ai-scan-error chứa "X"', () => {
    const report: AiDiagnosticReport = {
      engine: 'Gemini',
      generatedAt: '2026-11-16T10:00:00Z',
      insights: [],
    }
    render(<AiDiagnosisPopover report={report} scanError="X" />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/ }))
    const errEl = screen.getByTestId('ai-scan-error')
    expect(errEl.textContent).toContain('X')
    expect(errEl.getAttribute('role')).toBe('status')
  })
})

describe('overviewSlice — runAiDiagnosis', () => {
  const sampleReport: AiDiagnosticReport = {
    engine: 'Gemini',
    source: 'AI_SERVICE',
    generatedAt: '2026-11-16T10:00:00Z',
    insights: [],
    hasAnalysis: true,
  }

  const baseData: OverviewData = {
    project: { id: '5', name: 'Project 5', role: 'OWNER', phaseLabel: 'Phase 1', lastUpdatedAt: '2026-11-16T00:00:00Z' },
    metrics: { totalNodes: 0, criticalPathNodes: 0, completedNodes: 0, completionRate: 0, overdueCount: 0, blockingReleaseCount: 0, pendingReviewCount: 0 },
    velocity: { periodLabel: 'Last 7 days', days: [], hasData: false },
    statusBreakdown: { totalTasks: 0, items: [] },
    aiReport: { engine: 'Sample data', generatedAt: '2026-11-15T00:00:00Z', insights: [], hasAnalysis: false },
    guestAccess: { isActive: false, token: '', expiresAt: '', expiresLabel: '' },
    feedbackQueue: [],
    recentActivity: [],
  }

  it("runAiDiagnosis('5') thành công → data.aiReport thành report do fakeService.runAiDiagnosis trả, aiScanning về false", async () => {
    const runAiSpy = vi.fn().mockResolvedValue(sampleReport)
    const fakeService = {
      runAiDiagnosis: runAiSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        data: { ...baseData },
      },
    }))

    await store.getState().overview.runAiDiagnosis('5')

    expect(runAiSpy).toHaveBeenCalledWith('5')
    expect(store.getState().overview.data?.aiReport).toEqual(sampleReport)
    expect(store.getState().overview.aiScanning).toBe(false)
    expect(store.getState().overview.aiScanError).toBeNull()
  })

  it('fakeService.runAiDiagnosis ném 429 COOLDOWN_ACTIVE kèm retryAfterSeconds 90 → aiScanError chứa "90s", data.aiReport giữ nguyên bản cũ, aiScanning về false', async () => {
    const error429 = new ApiError({
      status: 429,
      code: 'COOLDOWN_ACTIVE',
      message: 'x',
      retryAfterSeconds: 90,
    })
    const runAiSpy = vi.fn().mockRejectedValue(error429)
    const fakeService = {
      runAiDiagnosis: runAiSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    const initialReport = { ...baseData.aiReport }
    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        data: { ...baseData, aiReport: initialReport },
      },
    }))

    await store.getState().overview.runAiDiagnosis('5')

    expect(store.getState().overview.aiScanError).toContain('90s')
    expect(store.getState().overview.data?.aiReport).toEqual(initialReport)
    expect(store.getState().overview.aiScanning).toBe(false)
  })

  it('ném 403 → aiScanError chứa "permission"', async () => {
    const error403 = new ApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Access denied',
    })
    const runAiSpy = vi.fn().mockRejectedValue(error403)
    const fakeService = {
      runAiDiagnosis: runAiSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        data: { ...baseData },
      },
    }))

    await store.getState().overview.runAiDiagnosis('5')

    expect(store.getState().overview.aiScanError).toContain('permission')
    expect(store.getState().overview.aiScanning).toBe(false)
  })

  it('fakeService.runAiDiagnosis ném 503 AI_SERVICE_UNAVAILABLE → aiScanError chứa "unavailable", data.aiReport giữ nguyên bản cũ, aiScanning về false', async () => {
    const error503 = new ApiError({
      status: 503,
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'AI service is unavailable',
    })
    const runAiSpy = vi.fn().mockRejectedValue(error503)
    const fakeService = {
      runAiDiagnosis: runAiSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    const initialReport = { ...baseData.aiReport }
    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        data: { ...baseData, aiReport: initialReport },
      },
    }))

    await store.getState().overview.runAiDiagnosis('5')

    expect(store.getState().overview.aiScanError).toContain('unavailable')
    expect(store.getState().overview.data?.aiReport).toEqual(initialReport)
    expect(store.getState().overview.aiScanning).toBe(false)
  })

  it("đang chạy dự án '5' thì load sang dự án '6', sau đó runAiDiagnosis của '5' ném lỗi → aiScanError của overview vẫn null", async () => {
    let rejectRunAi!: (reason?: unknown) => void
    const runAiPromise = new Promise<AiDiagnosticReport>((_, reject) => {
      rejectRunAi = reject
    })
    const runAiSpy = vi.fn().mockReturnValue(runAiPromise)
    const getOverviewSpy = vi.fn().mockResolvedValue({
      ...baseData,
      project: { ...baseData.project, id: '6', name: 'Project 6' },
    })
    const fakeService = {
      runAiDiagnosis: runAiSpy,
      getOverviewData: getOverviewSpy,
    } as unknown as IWorkflowService

    type TestStore = OverviewSlice & { currentProjectId: string | null }
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, fakeService),
    }))

    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        data: { ...baseData },
      },
    }))

    const diagnosisPromise = store.getState().overview.runAiDiagnosis('5')
    expect(store.getState().overview.aiScanning).toBe(true)

    await store.getState().overview.load('6')
    expect(store.getState().overview.projectId).toBe('6')
    expect(store.getState().overview.aiScanError).toBeNull()

    rejectRunAi(new ApiError({ status: 429, code: 'COOLDOWN_ACTIVE', message: 'Rate limit' }))
    await diagnosisPromise

    expect(store.getState().overview.projectId).toBe('6')
    expect(store.getState().overview.aiScanError).toBeNull()
  })
})

describe('TASK_51: Weekly Velocity & computeWeeklyVelocity', () => {
  const fixedNow = new Date('2026-11-17T12:00:00').getTime()

  it('dự án không có node -> hasData: false, unavailableNote câu mới', () => {
    const res = computeWeeklyVelocity([], fixedNow)
    expect(res.hasData).toBe(false)
    expect(res.days).toEqual([])
    expect(res.unavailableNote).toBe('No tasks yet. The chart will appear once the pipeline has tasks.')
  })

  it('dự án có node nhưng chưa task nào xong -> hasData: true, mọi cột 0', () => {
    const nodes = [
      { id: '1', code: 'WPE-001', title: 'Task 1', status: 'TODO' as const },
      { id: '2', code: 'WPE-002', title: 'Task 2', status: 'IN_PROGRESS' as const },
    ]
    const res = computeWeeklyVelocity(nodes, fixedNow)
    expect(res.hasData).toBe(true)
    expect(res.days).toHaveLength(7)
    expect(res.days.every((d) => d.tasks === 0)).toBe(true)
  })

  it('node DONE có completedAt hôm nay -> cột hôm nay = 1', () => {
    const todayIso = new Date(fixedNow).toISOString()
    const nodes = [
      { id: '1', code: 'WPE-001', title: 'Task 1', status: 'DONE' as const, completedAt: todayIso },
    ]
    const res = computeWeeklyVelocity(nodes, fixedNow)
    expect(res.hasData).toBe(true)
    expect(res.days).toHaveLength(7)
    const todayBucket = res.days[res.days.length - 1]
    expect(todayBucket.tasks).toBe(1)
  })

  it('node DONE ngoài 7 ngày không tính', () => {
    const tenDaysAgo = new Date('2026-11-07T12:00:00').toISOString()
    const nodes = [
      { id: '1', code: 'WPE-001', title: 'Old Task', status: 'DONE' as const, completedAt: tenDaysAgo },
    ]
    const res = computeWeeklyVelocity(nodes, fixedNow)
    expect(res.hasData).toBe(true)
    expect(res.days.every((d) => d.tasks === 0)).toBe(true)
  })

  it('WeeklyVelocityCard không còn câu "chưa có updatedAt"', () => {
    render(<WeeklyVelocityCard velocity={{ periodLabel: 'Last 7 days', days: [], hasData: false }} />)
    const cardEl = screen.getByTestId('weekly-velocity-unavailable')
    expect(cardEl.textContent).not.toContain('chưa có updatedAt')
    expect(cardEl.textContent).toBe('No tasks yet. The chart will appear once the pipeline has tasks.')
  })
})
