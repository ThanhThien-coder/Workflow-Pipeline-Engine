// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  completeAllInPhase,
  expireGuestLink,
  expireInvitations,
  fetchDemoStatus,
  forceStatus,
  makeOverdue,
  resetAiCooldown,
  runOverdueScan,
  sendTestNotification,
} from '../demo'

type Call = { method: string; url: string; body: unknown }

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined) return new Response(null, { status })
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('TASK_74: demo HTTP API (impl/http/demo.ts)', () => {
  let calls: Call[]
  let responder: (call: Call) => Response

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    responder = () => jsonResponse(204)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const call: Call = {
          method: init?.method ?? 'GET',
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        }
        calls.push(call)
        return responder(call)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchDemoStatus: GET /demo/status, trả enabled', async () => {
    responder = () => jsonResponse(200, { enabled: true })
    expect(await fetchDemoStatus()).toBe(true)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toMatch(/\/demo\/status$/)
  })

  it('fetchDemoStatus: enabled false -> false; lỗi 404 -> false; lỗi mạng -> false', async () => {
    responder = () => jsonResponse(200, { enabled: false })
    expect(await fetchDemoStatus()).toBe(false)
    responder = () => jsonResponse(404, { error: 'NOT_FOUND', message: 'x' })
    expect(await fetchDemoStatus()).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    expect(await fetchDemoStatus()).toBe(false)
  })

  it('mỗi hàm gọi đúng method + URL + body', async () => {
    responder = (c) => {
      if (c.url.endsWith('/overdue-scan')) return jsonResponse(200, { overdueCount: 2 })
      if (c.url.endsWith('/complete-all')) return jsonResponse(200, { completedCount: 3 })
      if (c.url.endsWith('/invitations/expire')) return jsonResponse(200, { expiredCount: 1 })
      if (c.url.includes('/nodes/')) return jsonResponse(200, { id: 9 })
      return jsonResponse(204)
    }

    await makeOverdue('5', '9')
    await expect(runOverdueScan('5')).resolves.toEqual({ overdueCount: 2 })
    await forceStatus('5', '9', 'DONE')
    await expect(completeAllInPhase('5', '7')).resolves.toEqual({ completedCount: 3 })
    await resetAiCooldown('5')
    await expireGuestLink('5')
    await expect(expireInvitations('5')).resolves.toEqual({ expiredCount: 1 })
    await sendTestNotification('5')

    const got = calls.map((c) => `${c.method} ${c.url.replace(/^.*\/demo/, '/demo')}`)
    expect(got).toEqual([
      'POST /demo/projects/5/nodes/9/make-overdue',
      'POST /demo/projects/5/overdue-scan',
      'POST /demo/projects/5/nodes/9/force-status',
      'POST /demo/projects/5/phases/7/complete-all',
      'POST /demo/projects/5/ai-cooldown/reset',
      'POST /demo/projects/5/guest-link/expire',
      'POST /demo/projects/5/invitations/expire',
      'POST /demo/projects/5/notifications/test',
    ])
    expect(calls[2].body).toEqual({ status: 'DONE' })
  })
})
