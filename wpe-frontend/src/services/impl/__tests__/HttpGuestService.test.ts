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

  it('G25: AI và đánh giá chưa có backend -> features tắt, không dùng dữ liệu giả', async () => {
    const service = new HttpGuestService()
    expect(service.features).toEqual({ aiSummary: false, evaluation: false })
    await expect(service.getAiSummary('test-token')).rejects.toThrow('not available')
    await expect(service.listFeedback('test-token', 's1')).resolves.toEqual([])
    await expect(service.getMyEvaluation('test-token', 's1')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
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
