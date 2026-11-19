// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService } from '../../HttpWorkflowService'

/** S04: reopenTask / getReopenImpact gọi đúng endpoint và map reopenedAt. */

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Call = { method: string; url: string; body: any }

describe('HttpWorkflowService: mở lại task Done', () => {
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const path = String(url)
      calls.push({ method, url: path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (method === 'POST' && path.endsWith('/nodes/10/reopen')) {
        return jsonResponse(200, {
          id: '10', phaseId: '5', code: 'WPE-010', title: 'T', status: 'IN_PROGRESS', assignedUserId: '2',
          joinPolicy: 'ALL_COMPLETED', rejectReason: 'Wrong', isOverdue: false, version: 8, reopenedAt: '2026-11-19T10:00:00Z', artifacts: [],
        })
      }
      if (method === 'GET' && path.endsWith('/nodes/10/reopen-impact')) {
        return jsonResponse(200, { taskCode: 'WPE-010', children: [{ id: 11, code: 'WPE-011', title: 'C', status: 'TODO', willRelock: true }] })
      }
      return jsonResponse(404, { error: 'NOT_FOUND', message: 'no' })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reopenTask: POST /nodes/10/reopen với {reason, version} và trả task có reopenedAt', async () => {
    const svc = new HttpWorkflowService()
    const task = await svc.reopenTask('10', 'Wrong')
    const call = calls.find((c) => c.method === 'POST')!
    expect(call.url).toContain('/nodes/10/reopen')
    expect(call.body).toEqual({ reason: 'Wrong', version: 0 })
    expect(task.status).toBe('IN_PROGRESS')
    expect(task.reopenedAt).toBe('2026-11-19T10:00:00Z')
    expect(task.version).toBe(8)
  })

  it('getReopenImpact: GET /nodes/10/reopen-impact và map danh sách con', async () => {
    const svc = new HttpWorkflowService()
    const impact = await svc.getReopenImpact('10')
    expect(impact.taskCode).toBe('WPE-010')
    expect(impact.children).toEqual([{ id: '11', code: 'WPE-011', title: 'C', status: 'TODO', willRelock: true }])
  })
})
