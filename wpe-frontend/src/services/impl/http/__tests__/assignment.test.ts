// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { patchAssignment } from '../assignment'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'
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

describe('Assignment API (impl/http/assignment.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({
        method,
        url: String(url),
        body: parsedBody,
      })

      if (method === 'PATCH' && String(url).endsWith('/nodes/5/assignment')) {
        const bodyObj = parsedBody || {}
        if (bodyObj.version === 999) {
          return jsonResponse(409, {
            status: 409,
            error: 'OPTIMISTIC_LOCK_CONFLICT',
            message: 'Phiên bản task không khớp. Vui lòng tải lại trang.',
          })
        }
        return jsonResponse(200, {
          id: 5,
          phaseId: 1,
          code: 'WPE-005',
          title: 'Tối ưu hóa query DB',
          description: 'Mô tả',
          status: 'IN_PROGRESS',
          joinPolicy: 'ALL_COMPLETED',
          assignedUserId: bodyObj.assignedUserId !== undefined ? bodyObj.assignedUserId : 1,
          dueDate: bodyObj.dueDate !== undefined ? bodyObj.dueDate : '2026-10-30T23:59:59.000Z',
          estimatedHours: 4,
          version: (bodyObj.version ?? 0) + 1,
        })
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

  it('updateTaskAssignment không nằm trong METHODS_STILL_MOCKED', () => {
    expect((METHODS_STILL_MOCKED as readonly string[])).not.toContain('updateTaskAssignment')
  })

  it('gọi đúng PATCH /nodes/5/assignment khi chỉ truyền assignedUserId (chuyển sang số nếu là chuỗi số)', async () => {
    const result = await patchAssignment('5', { assignedUserId: '2', version: 1 })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toMatch(/\/nodes\/5\/assignment$/)
    expect(calls[0].body).toEqual({
      version: 1,
      assignedUserId: 2,
    })
    expect(calls[0].body).not.toHaveProperty('dueDate')

    expect(result).toEqual({
      assignedUserId: '2',
      dueDate: '2026-10-30T23:59:59.000Z',
      version: 2,
    })
  })

  it('giữ nguyên assignedUserId dạng chuỗi nếu không phải chuỗi số', async () => {
    await patchAssignment('5', { assignedUserId: 'user-alpha', version: 2 })

    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({
      version: 2,
      assignedUserId: 'user-alpha',
    })
  })

  it('gọi đúng PATCH /nodes/5/assignment khi chỉ truyền dueDate', async () => {
    const result = await patchAssignment('5', {
      dueDate: '2026-11-15T23:59:59.000Z',
      version: 3,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toMatch(/\/nodes\/5\/assignment$/)
    expect(calls[0].body).toEqual({
      version: 3,
      dueDate: '2026-11-15T23:59:59.000Z',
    })
    expect(calls[0].body).not.toHaveProperty('assignedUserId')

    expect(result).toEqual({
      assignedUserId: '1',
      dueDate: '2026-11-15T23:59:59.000Z',
      version: 4,
    })
  })

  it('gọi đúng PATCH /nodes/5/assignment khi truyền cả 2 trường và map response đúng', async () => {
    const result = await patchAssignment(5, {
      assignedUserId: '4',
      dueDate: '2026-12-01T23:59:59.000Z',
      version: 5,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({
      version: 5,
      assignedUserId: 4,
      dueDate: '2026-12-01T23:59:59.000Z',
    })

    expect(result).toEqual({
      assignedUserId: '4',
      dueDate: '2026-12-01T23:59:59.000Z',
      version: 6,
    })
  })

  it('xử lý an toàn khi response có assignedUserId hoặc dueDate là null/undefined', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(200, {
        id: 5,
        assignedUserId: null,
        dueDate: null,
        version: 10,
      })
    )

    const result = await patchAssignment('5', { assignedUserId: '2', version: 9 })
    expect(result).toEqual({
      assignedUserId: '',
      dueDate: '',
      version: 10,
    })
  })

  it('ném ApiError khi backend trả 409 Conflict', async () => {
    await expect(
      patchAssignment('5', { assignedUserId: '2', version: 999 })
    ).rejects.toThrow(ApiError)

    try {
      await patchAssignment('5', { assignedUserId: '2', version: 999 })
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(409)
      expect(apiErr.code).toBe('OPTIMISTIC_LOCK_CONFLICT')
    }
  })

  it('HttpWorkflowService.updateTaskAssignment gọi backend thật (không mock)', async () => {
    const svc = new HttpWorkflowService()
    const result = await svc.updateTaskAssignment('5', {
      assignedUserId: '3',
      version: 1,
    })

    expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/nodes/5/assignment'))).toBe(true)
    expect(result).toEqual({
      assignedUserId: '3',
      dueDate: '2026-10-30T23:59:59.000Z',
      version: 2,
    })
  })
})
