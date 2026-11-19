// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpGuestService } from '../HttpGuestService'

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined || body === null) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('D5: HttpGuestService (impl/HttpGuestService.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const urlStr = String(url)
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined

      if (method === 'GET' && urlStr.endsWith('/guest/test-token/overview')) {
        return jsonResponse(200, {
          projectName: 'Real Project Overview',
          phaseLabel: '1. Phase 1',
          lastUpdated: '2026-11-12T00:00:00Z',
          totalNodes: 12,
          criticalNodes: 4,
          completedNodes: 8,
          completionPct: 66.7,
          overdueCount: 0,
          blockingCount: 1,
          totalTasks: 12,
          velocity: [{ day: 'T2', value: 3 }],
          statusBreakdown: [{ key: 'done', label: 'Done', count: 8 }],
          recentActivity: [],
        })
      }

      if (method === 'POST' && urlStr.endsWith('/guest/test-token/feedback')) {
        return jsonResponse(201, {
          id: 10,
          projectId: 1,
          nodeId: null,
          reviewerName: parsedBody?.reviewerName || 'Khách truy cập',
          reviewerRole: parsedBody?.reviewerRole || 'GUEST',
          content: parsedBody?.content,
          status: 'OPEN',
          createdAt: '2026-11-12T01:00:00Z',
        })
      }

      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'Not found' })
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getOverview gọi API backend thật qua fetch', async () => {
    const service = new HttpGuestService()
    const overview = await service.getOverview('test-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/guest/test-token/overview')
    expect(init?.method).toBe('GET')
    expect(overview.projectName).toBe('Real Project Overview')
    expect(overview.totalNodes).toBe(12)
    expect(overview.completedNodes).toBe(8)
  })

  it('G25: getLinkInfo dùng token thật (hex 64 ký tự, không có tiền tố gst_) và lấy tên dự án từ overview', async () => {
    const service = new HttpGuestService()
    const info = await service.getLinkInfo('test-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/guest/test-token/overview')
    expect(info).toEqual({ projectName: 'Real Project Overview', ownerName: '' })
  })

  it('G25: getLinkInfo với link bị thu hồi / dự án lưu trữ -> ném lỗi API 403 kèm lý do của backend', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(403, { status: 403, error: 'REVOKED_GUEST', message: 'The project owner has revoked this share link.' }),
    )
    const service = new HttpGuestService()
    await expect(service.getLinkInfo('revoked-token')).rejects.toMatchObject({
      status: 403,
      message: 'The project owner has revoked this share link.',
    })
  })

  it('S08: AI summary bật (API thật), evaluation vẫn tắt và không dùng dữ liệu giả', async () => {
    const service = new HttpGuestService()
    expect(service.features).toEqual({ aiSummary: true, evaluation: false })
    await expect(service.listFeedback('test-token', 's1')).resolves.toEqual([])
    await expect(service.getMyEvaluation('test-token', 's1')).resolves.toBeNull()
    await expect(service.generateAiReport('test-token')).rejects.toThrow('not available')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('S08: getAiSummary gọi GET /guest/{token}/ai-summary và map đúng khuôn', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(200, { content: 'Healthy', highlights: ['h1'], risks: ['WPE-1: slow'], generatedAt: '2026-11-19T01:00:00Z' }),
    )
    const service = new HttpGuestService()
    const ai = await service.getAiSummary('test-token')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/guest/test-token/ai-summary')
    expect(init?.method).toBe('GET')
    expect(ai).toEqual({ content: 'Healthy', highlights: ['h1'], risks: ['WPE-1: slow'], generatedAt: '2026-11-19T01:00:00.000Z' })
  })

  it('S08: getAiSummary 404 AI_SUMMARY_NOT_FOUND -> ném ApiError (trang khách ẩn khối AI)', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(404, { status: 404, error: 'AI_SUMMARY_NOT_FOUND', message: 'No AI analysis is available for this project yet.' }),
    )
    const service = new HttpGuestService()
    await expect(service.getAiSummary('test-token')).rejects.toMatchObject({ status: 404, code: 'AI_SUMMARY_NOT_FOUND' })
  })

  it('S08: getOverview map phases và memberCount (field cũ giữ nguyên)', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(200, {
        projectName: 'P',
        totalNodes: 3,
        completedNodes: 1,
        phases: [
          { name: 'Design', status: 'COMPLETED', progressPct: 100, totalTasks: 1, doneTasks: 1 },
          { name: 'Build', status: 'WEIRD', progressPct: 50, totalTasks: 2, doneTasks: 1 },
        ],
        memberCount: 4,
      }),
    )
    const overview = await new HttpGuestService().getOverview('test-token')
    expect(overview.memberCount).toBe(4)
    expect(overview.phases).toEqual([
      { name: 'Design', status: 'COMPLETED', progressPct: 100, totalTasks: 1, doneTasks: 1 },
      { name: 'Build', status: 'TODO', progressPct: 50, totalTasks: 2, doneTasks: 1 },
    ])
    expect(overview.totalNodes).toBe(3)
  })

  it('submitFeedback gọi POST /guest/{token}/feedback qua fetch thật', async () => {
    const service = new HttpGuestService()
    const session = await service.createSession('test-token', 'Thầy Giáo Viên')
    expect(fetchMock).not.toHaveBeenCalled() // phiên khách chỉ lưu ở trình duyệt

    const result = await service.submitFeedback('test-token', {
      sessionId: session.sessionId,
      message: 'Thiết kế hệ thống rất tốt',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/guest/test-token/feedback')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      reviewerName: 'Thầy Giáo Viên',
      reviewerRole: 'GUEST',
      content: 'Thiết kế hệ thống rất tốt',
      nodeId: null,
    })
    expect(result.id).toBe('10')
    expect(result.author).toBe('Thầy Giáo Viên')
    expect(result.message).toBe('Thiết kế hệ thống rất tốt')
  })
})
