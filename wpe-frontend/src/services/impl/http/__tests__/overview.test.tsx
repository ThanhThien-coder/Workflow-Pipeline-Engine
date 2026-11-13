// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { create } from 'zustand'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'
import { MockWorkflowService } from '../../../MockWorkflowService'
import { computeOverviewStats, mapAiAnalysisToReport } from '../overview'
import { createOverviewSlice, type OverviewSlice } from '../../../../store/slices/overviewSlice'
import { GuestAccessPopover } from '../../../../components/popovers/GuestAccessPopover'
import { OverviewView } from '../../../../components/views/OverviewView'
import { useWorkflowStore } from '../../../../store/useWorkflowStore'
import { ApiError } from '../../../http/ApiError'
import type { IWorkflowService } from '../../../contracts/IWorkflowService'
import type { OverviewData } from '../../../../types/overview.types'

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

  it('computeOverviewStats: đồ thị 4 node (2 DONE, 1 trễ hạn) → 50%, overdue 1; ẩn velocity khi thiếu updatedAt', () => {
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
    expect(stats.velocity.hasData).toBe(false)
    expect(stats.velocity.days).toEqual([])
    expect(stats.velocity.unavailableNote).toBeTruthy()
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
    expect(emptyReport.emptyMessage).toBe('Chưa có chẩn đoán')
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
    expect(screen.getByTestId('guest-owner-only-note').textContent).toContain('Chỉ chủ dự án')
    fireEvent.click(genBtn)
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it('OverviewView: ẩn card Weekly Velocity khi không có updatedAt, hiện "Chưa có chẩn đoán" khi AI rỗng', () => {
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
        unavailableNote: 'Biểu đồ Weekly Velocity tạm ẩn vì dữ liệu node từ server chưa có updatedAt.',
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
        emptyMessage: 'Chưa có chẩn đoán',
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
    expect(screen.getByTestId('ai-diagnosis-empty').textContent).toContain('Chưa có chẩn đoán')
    expect(screen.getByTestId('recent-activity-empty')).toBeTruthy()
  })
})
