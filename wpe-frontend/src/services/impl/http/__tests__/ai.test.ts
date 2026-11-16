// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerAiDiagnostics } from '../ai'
import { ApiError } from '../../../http/ApiError'

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

describe('triggerAiDiagnostics', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("gọi triggerAiDiagnostics('7') → request POST tới đường dẫn kết thúc bằng /projects/7/ai-diagnostics", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      return jsonResponse(200, {
        analyzedAt: '2026-11-16T10:00:00Z',
        source: 'AI_SERVICE',
        insights: [],
      })
    })

    const res = await triggerAiDiagnostics('7')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toMatch(/\/projects\/7\/ai-diagnostics$/)
    expect(res).toBeDefined()
  })

  it('server trả 429 { error: "COOLDOWN_ACTIVE", retryAfterSeconds: 120 } → ném ApiError có status 429, retryAfterSeconds 120', async () => {
    fetchMock.mockImplementation(async () => {
      return jsonResponse(429, {
        status: 429,
        error: 'COOLDOWN_ACTIVE',
        message: 'AI diagnosis was run recently',
        retryAfterSeconds: 120,
      })
    })

    await expect(triggerAiDiagnostics('7')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(429)
      expect(apiErr.code).toBe('COOLDOWN_ACTIVE')
      expect(apiErr.retryAfterSeconds).toBe(120)
      return true
    })
  })
})
