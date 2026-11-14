// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { create } from 'zustand'
import { HttpWorkflowService } from '../../HttpWorkflowService'
import { mapAiAnalysisToReport } from '../overview'
import { createOverviewSlice, type OverviewSlice } from '../../../../store/slices/overviewSlice'
import { AiDiagnosisPopover } from '../../../../components/popovers/AiDiagnosisPopover'
import { ApiError } from '../../../http/ApiError'
import type { IWorkflowService } from '../../../contracts/IWorkflowService'
import type { AiDiagnosticReport, OverviewData } from '../../../../types/overview.types'
// Fixture dùng chung với backend Java (HttpAiServiceClientTest) và service Python:
// nếu hợp đồng đổi mà fixture không đổi theo, test ở cả hai phía sẽ đỏ.
import contractResponse from '../../../../../../shared/test-fixtures/ai-diagnose.response.json'

function jsonResponse(status: number, body?: unknown): Response {
  if (body === undefined || body === null) return new Response(null, { status })
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const report = (over: Partial<AiDiagnosticReport> = {}): AiDiagnosticReport => ({
  engine: 'Gemini',
  generatedAt: '2026-11-14T00:00:00Z',
  insights: [
    {
      id: 'i1', kind: 'BOTTLENECK', severity: 'HIGH', icon: '🔴', kicker: 'k', tag: 'HIGH',
      title: 'WPE-002', description: 'trễ', relatedNodeIds: ['WPE-002'], boxClass: '', tagClass: '',
    },
  ],
  hasAnalysis: true,
  ...over,
})

describe('Chẩn đoán AI — mapper theo hợp đồng đã duyệt', () => {
  it('response mẫu của hợp đồng → 4 insight (1 bottleneck + 1 trap + 2 advice) và source AI_SERVICE', () => {
    const r = mapAiAnalysisToReport(contractResponse, '2026-11-14T00:00:00Z')

    expect(r.hasAnalysis).toBe(true)
    expect(r.insights).toHaveLength(4)
    expect(r.insights.map((i) => i.kind)).toEqual(['BOTTLENECK', 'CRITICAL_PATH', 'RECOMMENDATION', 'RECOMMENDATION'])
    expect(r.insights[0].relatedNodeIds).toEqual(['WPE-002'])
    expect(r.source).toBe('AI_SERVICE')
    expect(r.warning).toBeUndefined()
    expect(r.generatedAt).toBe('2026-11-12T09:44:15.000Z')
  })

  it('MOCK_FALLBACK: giữ lại source và warning để UI báo dữ liệu giả', () => {
    const r = mapAiAnalysisToReport(
      { ...contractResponse, source: 'MOCK_FALLBACK', warning: 'Không gọi được dịch vụ AI (timeout), đang hiển thị dữ liệu giả.' },
      '2026-11-14T00:00:00Z',
    )

    expect(r.source).toBe('MOCK_FALLBACK')
    expect(r.warning).toContain('Không gọi được dịch vụ AI')
  })
})

describe('Chẩn đoán AI — gọi POST /ai-diagnostics', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('HttpWorkflowService.triggerAiDiagnostics gọi đúng POST và trả báo cáo đã chuyển đổi', async () => {
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/projects\/5\/ai-diagnostics$/)
      expect(init?.method).toBe('POST')
      return jsonResponse(200, contractResponse)
    })

    const result = await new HttpWorkflowService().triggerAiDiagnostics('5')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.insights).toHaveLength(4)
    expect(result.source).toBe('AI_SERVICE')
  })

  it('429 COOLDOWN_ACTIVE → ném ApiError có code và retryAfterSeconds', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, { status: 429, error: 'COOLDOWN_ACTIVE', message: 'Đang trong cooldown', retryAfterSeconds: 120 }),
    )

    await expect(new HttpWorkflowService().triggerAiDiagnostics('5')).rejects.toMatchObject({
      status: 429,
      code: 'COOLDOWN_ACTIVE',
      retryAfterSeconds: 120,
    })
  })
})

describe('Chẩn đoán AI — overviewSlice.runAiDiagnosis', () => {
  type TestStore = OverviewSlice & { currentProjectId: string | null }

  function makeStore(service: Partial<IWorkflowService>) {
    const store = create<TestStore>()((set, get) => ({
      currentProjectId: '5',
      ...createOverviewSlice(set, get, service as IWorkflowService),
    }))
    store.setState((state) => ({
      overview: {
        ...state.overview,
        projectId: '5',
        status: 'ready',
        data: {
          project: { id: '5', name: 'P', role: 'OWNER', phaseLabel: 'Draft', lastUpdatedAt: '2026-11-14T00:00:00Z' },
          metrics: { totalNodes: 0, criticalPathNodes: 0, completedNodes: 0, completionRate: 0, overdueCount: 0, blockingReleaseCount: 0, pendingReviewCount: 0 },
          velocity: { periodLabel: 'Last 7 days', days: [], hasData: false },
          statusBreakdown: { totalTasks: 0, items: [] },
          aiReport: { engine: 'Gemini', generatedAt: '2026-11-14T00:00:00Z', insights: [], hasAnalysis: false },
          guestAccess: { isActive: false, token: '', expiresAt: '', expiresLabel: '' },
          feedbackQueue: [],
          recentActivity: [],
        } as OverviewData,
      },
    }))
    return store
  }

  it('thành công: gọi service với projectId của route và cập nhật aiReport', async () => {
    const fresh = report({ source: 'MOCK' })
    const trigger = vi.fn().mockResolvedValue(fresh)
    const store = makeStore({ triggerAiDiagnostics: trigger })

    const ok = await store.getState().overview.runAiDiagnosis()

    expect(ok).toBe(true)
    expect(trigger).toHaveBeenCalledWith('5')
    expect(store.getState().overview.data?.aiReport).toEqual(fresh)
  })

  it('429: không đổi aiReport, toast nêu số giây còn lại', async () => {
    const trigger = vi.fn().mockRejectedValue(
      new ApiError({ status: 429, code: 'COOLDOWN_ACTIVE', message: 'cooldown', retryAfterSeconds: 120 }),
    )
    const store = makeStore({ triggerAiDiagnostics: trigger })

    const ok = await store.getState().overview.runAiDiagnosis('5')

    expect(ok).toBe(false)
    expect(store.getState().overview.toast).toContain('120')
    expect(store.getState().overview.data?.aiReport.hasAnalysis).toBe(false)
  })

  it('lỗi khác: toast hiện message của lỗi', async () => {
    const trigger = vi.fn().mockRejectedValue(new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Không có quyền' }))
    const store = makeStore({ triggerAiDiagnostics: trigger })

    await store.getState().overview.runAiDiagnosis('5')

    expect(store.getState().overview.toast).toBe('Không có quyền')
  })
})

describe('Chẩn đoán AI — AiDiagnosisPopover', () => {
  afterEach(() => cleanup())

  it('MOCK_FALLBACK: hiện cảnh báo và nhãn "Dữ liệu giả lập" thay vì Gemini', () => {
    render(
      <AiDiagnosisPopover
        report={report({ source: 'MOCK_FALLBACK', warning: 'Không gọi được dịch vụ AI (timeout), đang hiển thị dữ liệu giả.' })}
        onRescan={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/i }))

    expect(screen.getByTestId('ai-warning').textContent).toContain('Không gọi được dịch vụ AI')
    expect(screen.getByText(/Dữ liệu giả lập/)).toBeTruthy()
    expect(screen.queryByText(/Gemini Engine/)).toBeNull()
  })

  it('AI thật (AI_SERVICE): nhãn Gemini, không có cảnh báo', () => {
    render(<AiDiagnosisPopover report={report({ source: 'AI_SERVICE' })} onRescan={vi.fn().mockResolvedValue(undefined)} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/i }))

    expect(screen.getByText(/Gemini Engine/)).toBeTruthy()
    expect(screen.queryByTestId('ai-warning')).toBeNull()
  })

  it('bấm Re-scan gọi onRescan thật và khóa nút trong lúc chờ', async () => {
    let finish: () => void = () => {}
    const onRescan = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<AiDiagnosisPopover report={report()} onRescan={onRescan} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/i }))

    fireEvent.click(screen.getByRole('button', { name: /Re-scan Pipeline/i }))

    expect(onRescan).toHaveBeenCalledTimes(1)
    const scanning = screen.getByRole('button', { name: /Scanning/i }) as HTMLButtonElement
    expect(scanning.disabled).toBe(true)

    finish()
    await waitFor(() => expect(screen.getByRole('button', { name: /Re-scan Pipeline/i })).toBeTruthy())
  })

  it('chưa có chẩn đoán: hiện trạng thái trống và nút "Chạy chẩn đoán"', () => {
    const onRescan = vi.fn().mockResolvedValue(undefined)
    render(
      <AiDiagnosisPopover
        report={{ engine: 'Gemini', generatedAt: '2026-11-14T00:00:00Z', insights: [], hasAnalysis: false, emptyMessage: 'Chưa có chẩn đoán' }}
        onRescan={onRescan}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI Diagnosis/i }))

    expect(screen.getByTestId('ai-empty-state')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Chạy chẩn đoán/i }))
    expect(onRescan).toHaveBeenCalledTimes(1)
  })
})
