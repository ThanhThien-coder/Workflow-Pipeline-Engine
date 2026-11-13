// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createOrRenewGuestToken,
  fetchGuestOverview,
  getGuestAccess,
  listFeedbacks,
  resolveFeedback,
  revokeGuestToken,
  submitGuestFeedback,
} from '../guest'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'

function jsonResponse(status: number, body?: unknown, headers?: Record<string, string>): Response {
  if (status === 204 || body === undefined || body === null) {
    return new Response(null, { status, headers })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  })
}

type Call = { method: string; url: string; body: unknown }

describe('D5: guest & feedback HTTP API (impl/http/guest.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const urlStr = String(url)
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, url: urlStr, body: parsedBody })

      // GET /projects/7/guest-token
      if (method === 'GET' && urlStr.endsWith('/projects/7/guest-token')) {
        return jsonResponse(200, {
          enabled: true,
          token: 'example-token-abc123',
          shareUrl: 'http://localhost:5173/guest/example-token-abc123',
          expiresAt: '2026-11-20T10:00:00Z',
        })
      }

      // POST /projects/7/guest-token
      if (method === 'POST' && urlStr.endsWith('/projects/7/guest-token')) {
        return jsonResponse(200, {
          enabled: true,
          token: 'example-new-token-xyz789',
          shareUrl: 'http://localhost:5173/guest/example-new-token-xyz789',
          expiresAt: '2026-12-10T10:00:00Z',
        })
      }

      // DELETE /projects/7/guest-token
      if (method === 'DELETE' && urlStr.endsWith('/projects/7/guest-token')) {
        return jsonResponse(200, {
          enabled: false,
          token: null,
          shareUrl: null,
          expiresAt: null,
        })
      }

      // GET /projects/7/feedbacks
      if (method === 'GET' && urlStr.endsWith('/projects/7/feedbacks')) {
        return jsonResponse(200, [
          {
            id: 1,
            reviewerName: 'TS. Nguyen Van A',
            reviewerRole: 'TEACHER',
            nodeRef: {
              nodeId: 2,
              code: 'WPE-002',
              title: 'Đặc tả API',
            },
            content: 'Cần bổ sung Sequence Diagram',
            status: 'OPEN',
            createdAt: '2026-11-12T08:00:00Z',
          },
          {
            id: 2,
            reviewerName: 'Khách ngoài',
            reviewerRole: 'GUEST',
            node: null, // Test map node null
            content: 'Góp ý chung cho toàn dự án',
            status: 'OPEN',
            createdAt: '2026-11-12T09:00:00Z',
          },
        ])
      }

      // PATCH /projects/7/feedbacks/1/resolve
      if (method === 'PATCH' && urlStr.endsWith('/projects/7/feedbacks/1/resolve')) {
        return jsonResponse(200, {
          success: true,
          feedbackId: 1,
          status: 'RESOLVED',
        })
      }

      // POST /guest/token-123/feedback
      if (method === 'POST' && urlStr.endsWith('/guest/token-123/feedback')) {
        if (parsedBody?.content === 'spam-trigger') {
          return jsonResponse(
            429,
            {
              status: 429,
              error: 'COOLDOWN_ACTIVE',
              message: 'Bạn gửi quá nhiều góp ý.',
              retryAfterSeconds: 3589,
            },
            { 'Retry-After': '3589' },
          )
        }
        return jsonResponse(201, {
          id: 99,
          projectId: 7,
          nodeId: null,
          reviewerName: parsedBody?.reviewerName || 'Khách truy cập',
          reviewerRole: parsedBody?.reviewerRole || 'GUEST',
          content: parsedBody?.content,
          status: 'OPEN',
          createdAt: '2026-11-12T10:00:00Z',
        })
      }

      // GET /guest/revoked-token/overview
      if (method === 'GET' && urlStr.endsWith('/guest/revoked-token/overview')) {
        return jsonResponse(403, {
          status: 403,
          error: 'REVOKED_GUEST',
          message: 'Liên kết chia sẻ này đã bị Chủ dự án thu hồi.',
        })
      }

      // GET /guest/valid-token/overview
      if (method === 'GET' && urlStr.endsWith('/guest/valid-token/overview')) {
        return jsonResponse(200, {
          projectName: 'Pipeline Engine Demo',
          phaseLabel: '1. Phase Khởi tạo',
          lastUpdated: '2026-11-12T05:00:00Z',
          totalNodes: 10,
          criticalNodes: 3,
          completedNodes: 4,
          completionPct: 40.0,
          overdueCount: 1,
          blockingCount: 2,
          totalTasks: 10,
          velocity: [{ day: 'T2', value: 2 }, { day: 'T3', value: 3 }],
          statusBreakdown: [
            { key: 'done', label: 'Hoàn thành', count: 4 },
            { key: 'inProgress', label: 'Đang thực hiện', count: 2 },
            { key: 'locked', label: 'Bị khóa (DAG)', count: 4 },
          ],
          recentActivity: [
            { id: 'act-1', initials: 'WPE', actor: 'Hệ thống', text: 'Vận hành DAG', ago: 'hôm nay' },
          ],
        })
      }

      // GET /projects/7
      if (method === 'GET' && urlStr.endsWith('/projects/7')) {
        return jsonResponse(200, {
          id: 7,
          name: 'Pipeline Engine Demo',
          description: '',
          status: 'ACTIVE',
          ownerId: 1,
          createdAt: '2026-11-10T00:00:00Z',
          updatedAt: '2026-11-12T05:00:00Z',
        })
      }

      // GET /projects/7/members
      if (method === 'GET' && urlStr.endsWith('/projects/7/members')) {
        return jsonResponse(200, [{ userId: 1, role: 'OWNER' }])
      }

      // GET /projects/7/graph
      if (method === 'GET' && urlStr.endsWith('/projects/7/graph')) {
        return jsonResponse(200, { phases: [], phaseEdges: [], nodes: [], dependencies: [] })
      }

      // GET /projects/7/activity
      if (method === 'GET' && urlStr.includes('/projects/7/activity')) {
        return jsonResponse(200, [])
      }

      // GET /projects/7/ai-analysis
      if (method === 'GET' && urlStr.endsWith('/projects/7/ai-analysis')) {
        return jsonResponse(200, { hasAnalysis: false })
      }

      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'Not found' })
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getGuestAccess gọi GET /projects/7/guest-token và map đúng GuestAccessState', async () => {
    const res = await getGuestAccess('7')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toContain('/projects/7/guest-token')
    expect(res.isActive).toBe(true)
    expect(res.token).toBe('example-token-abc123')
    expect(res.expiresAt).toBe(new Date('2026-11-20T10:00:00Z').toISOString())
  })

  it('createOrRenewGuestToken gọi POST /projects/7/guest-token và gửi expiryDays', async () => {
    const res = await createOrRenewGuestToken('7', 15)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/projects/7/guest-token')
    expect(calls[0].body).toEqual({ expiryDays: 15 })
    expect(res.isActive).toBe(true)
    expect(res.token).toBe('example-new-token-xyz789')
  })

  it('revokeGuestToken gọi DELETE /projects/7/guest-token và trả isActive: false', async () => {
    const res = await revokeGuestToken('7')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].url).toContain('/projects/7/guest-token')
    expect(res.isActive).toBe(false)
    expect(res.token).toBe('')
  })

  it('listFeedbacks gọi GET /projects/7/feedbacks và map đúng node null', async () => {
    const items = await listFeedbacks('7')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toContain('/projects/7/feedbacks')
    expect(items).toHaveLength(2)

    // Item 1 có nodeRef
    expect(items[0].nodeRef).toEqual({
      nodeId: '2',
      code: 'WPE-002',
      title: 'Đặc tả API',
    })
    expect(items[0].reviewerName).toBe('TS. Nguyen Van A')
    expect(items[0].reviewerRole).toBe('TEACHER')
    expect(items[0].replyContent).toBeNull()

    // Item 2 node: null -> nodeRef là null
    expect(items[1].nodeRef).toBeNull()
    expect(items[1].reviewerName).toBe('Khách ngoài')
    expect(items[1].reviewerRole).toBe('GUEST')
    expect(items[1].replyContent).toBeNull()
  })

  it('resolveFeedback gọi PATCH /projects/7/feedbacks/1/resolve', async () => {
    await resolveFeedback('7', '1')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toContain('/projects/7/feedbacks/1/resolve')
  })

  it('submitGuestFeedback 429 ném ApiError có retryAfterSeconds', async () => {
    await expect(
      submitGuestFeedback('token-123', {
        reviewerName: 'Spammer',
        content: 'spam-trigger',
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'COOLDOWN_ACTIVE',
      retryAfterSeconds: 3589,
    })
  })

  it('submitGuestFeedback thành công trả về GuestFeedbackDto', async () => {
    const result = await submitGuestFeedback('token-123', {
      reviewerName: 'TS. Tran',
      reviewerRole: 'TEACHER',
      message: 'Góp ý hợp lệ',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/guest/token-123/feedback')
    expect(calls[0].body).toEqual({
      reviewerName: 'TS. Tran',
      reviewerRole: 'TEACHER',
      content: 'Góp ý hợp lệ',
      nodeId: null,
    })
    expect(result.id).toBe('99')
    expect(result.author).toBe('TS. Tran')
    expect(result.message).toBe('Góp ý hợp lệ')
  })

  it('fetchGuestOverview 403 ném ApiError có code REVOKED_GUEST', async () => {
    await expect(fetchGuestOverview('revoked-token')).rejects.toMatchObject({
      status: 403,
      code: 'REVOKED_GUEST',
    })
  })

  it('fetchGuestOverview 200 map đầy đủ số liệu KPI và danh sách', async () => {
    const data = await fetchGuestOverview('valid-token')

    expect(data.projectName).toBe('Pipeline Engine Demo')
    expect(data.totalNodes).toBe(10)
    expect(data.criticalNodes).toBe(3)
    expect(data.completedNodes).toBe(4)
    expect(data.completionPct).toBe(40.0)
    expect(data.statusBreakdown).toHaveLength(3)
    expect(data.statusBreakdown[2].key).toBe('blocked') // 'locked' mapped to 'blocked'
    expect(data.velocity).toHaveLength(2)
  })

  it('HttpWorkflowService: toggleGuestAccess, generateGuestToken, resolveFeedback gọi API thật', async () => {
    const svc = new HttpWorkflowService()

    // toggleGuestAccess true -> POST
    const activeState = await svc.toggleGuestAccess('7', true)
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/projects/7/guest-token'))).toBe(true)
    expect(activeState.isActive).toBe(true)

    // toggleGuestAccess false -> DELETE
    const inactiveState = await svc.toggleGuestAccess('7', false)
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/projects/7/guest-token'))).toBe(true)
    expect(inactiveState.isActive).toBe(false)

    // generateGuestToken -> POST
    const generated = await svc.generateGuestToken('7')
    expect(generated.isActive).toBe(true)

    // resolveFeedback -> PATCH
    await svc.resolveFeedback('7', '1')
    expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/projects/7/feedbacks/1/resolve'))).toBe(true)
  })

  it('HttpWorkflowService.getOverviewData: thay feedbackQueue và guestAccess thật', async () => {
    const svc = new HttpWorkflowService()

    const overview = await svc.getOverviewData('7')

    // Feedback queue được thay bằng 2 feedbacks thật
    expect(overview.feedbackQueue).toHaveLength(2)
    expect(overview.feedbackQueue[0].reviewerName).toBe('TS. Nguyen Van A')
    expect(overview.feedbackQueue[1].nodeRef).toBeNull()

    // Guest access lấy trạng thái thật
    expect(overview.guestAccess.isActive).toBe(true)
    expect(overview.guestAccess.token).toBe('example-token-abc123')

    // KPI & velocity vẫn giữ nguyên từ mock base
    expect(overview.metrics).toBeDefined()
    expect(overview.velocity).toBeDefined()
  })

  it('HttpWorkflowService.getOverviewData: khi getGuestAccess 403 (không phải owner) thì không ném lỗi mà tắt guestAccess', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const urlStr = String(url)
      if (method === 'GET' && urlStr.endsWith('/projects/7')) {
        return jsonResponse(200, {
          id: 7,
          name: 'Pipeline Engine Demo',
          description: '',
          status: 'ACTIVE',
          ownerId: 1,
          createdAt: '2026-11-10T00:00:00Z',
          updatedAt: '2026-11-12T05:00:00Z',
        })
      }
      if (method === 'GET' && urlStr.endsWith('/projects/7/graph')) {
        return jsonResponse(200, { phases: [], phaseEdges: [], nodes: [], dependencies: [] })
      }
      if (method === 'GET' && urlStr.includes('/projects/7/activity')) {
        return jsonResponse(200, [])
      }
      if (method === 'GET' && urlStr.endsWith('/projects/7/ai-analysis')) {
        return jsonResponse(200, { hasAnalysis: false })
      }
      if (method === 'GET' && urlStr.endsWith('/projects/7/guest-token')) {
        return jsonResponse(403, { status: 403, error: 'ACCESS_DENIED', message: 'Chỉ Owner được xem link' })
      }
      if (method === 'GET' && urlStr.endsWith('/projects/7/feedbacks')) {
        return jsonResponse(200, [])
      }
      return jsonResponse(404, { status: 404, error: 'NOT_FOUND' })
    })

    const svc = new HttpWorkflowService()
    const overview = await svc.getOverviewData('7')

    expect(overview.guestAccess.isActive).toBe(false)
    expect(overview.feedbackQueue).toHaveLength(0)
  })

  it('METHODS_STILL_MOCKED không còn chứa resolveFeedback, toggleGuestAccess, generateGuestToken, getOverviewData', () => {
    expect(METHODS_STILL_MOCKED).not.toContain('resolveFeedback')
    expect(METHODS_STILL_MOCKED).not.toContain('toggleGuestAccess')
    expect(METHODS_STILL_MOCKED).not.toContain('generateGuestToken')
    expect(METHODS_STILL_MOCKED).not.toContain('getOverviewData')
  })
})
