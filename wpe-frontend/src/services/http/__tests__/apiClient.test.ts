// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, setUnauthorizedHandler, API_BASE_URL, type UnauthorizedContext } from '../apiClient'
import { ApiError } from '../ApiError'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call][1] as RequestInit
  return init.headers as Record<string, string>
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    return error as ApiError
  }
  throw new Error('Mong đợi request bị lỗi nhưng lại thành công')
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setUnauthorizedHandler(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('base URL mặc định là http://localhost:8080/api/v1 và nối query đúng', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    await apiRequest('GET', '/projects/1/my-tasks', { query: { userId: 2, skip: undefined } })

    expect(API_BASE_URL).toBe('http://localhost:8080/api/v1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/projects/1/my-tasks?userId=2')
  })

  it('có token thì gửi Authorization: Bearer và không gửi X-Debug-User-Id', async () => {
    localStorage.setItem('wpe_auth_token', 'abc.def.ghi')
    localStorage.setItem('wpe_auth_user', JSON.stringify({ id: 7 }))
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    const data = await apiRequest<{ ok: boolean }>('GET', '/projects')

    expect(data).toEqual({ ok: true })
    const headers = sentHeaders(fetchMock)
    expect(headers['Authorization']).toBe('Bearer abc.def.ghi')
    expect(headers['X-Debug-User-Id']).toBeUndefined()
  })

  it('token nằm trong sessionStorage cũng được gửi', async () => {
    sessionStorage.setItem('wpe_auth_token', 'session-token')
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await apiRequest('GET', '/projects')

    expect(sentHeaders(fetchMock)['Authorization']).toBe('Bearer session-token')
  })

  it('không có token mà đang dev thì gửi X-Debug-User-Id lấy từ wpe_auth_user', async () => {
    sessionStorage.setItem('wpe_auth_user', JSON.stringify({ id: 3, displayName: 'Sarah' }))
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await apiRequest('GET', '/projects')

    const headers = sentHeaders(fetchMock)
    expect(import.meta.env.DEV).toBe(true)
    expect(headers['X-Debug-User-Id']).toBe('3')
    expect(headers['Authorization']).toBeUndefined()
  })

  it('không có token, không có user thì không gửi header danh tính nào', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await apiRequest('GET', '/projects')

    const headers = sentHeaders(fetchMock)
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['X-Debug-User-Id']).toBeUndefined()
  })

  it('gửi body dạng JSON kèm Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 9 }))

    await apiRequest('POST', '/projects', { body: { name: 'P' } })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'P' }))
    expect(sentHeaders(fetchMock)['Content-Type']).toBe('application/json')
  })

  it('409: ném ApiError với status, code (trường error), message, validationErrors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        status: 409,
        error: 'OPTIMISTIC_LOCK_CONFLICT',
        message: 'Dữ liệu tác vụ đã bị thay đổi',
        validationErrors: [{ field: 'version', rejectedValue: 2, reason: 'Current version in database is 3' }],
      }),
    )

    const error = await catchError(apiRequest('PATCH', '/nodes/15/status', { body: { version: 2 } }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(409)
    expect(error.code).toBe('OPTIMISTIC_LOCK_CONFLICT')
    expect(error.message).toBe('Dữ liệu tác vụ đã bị thay đổi')
    expect(error.validationErrors).toEqual([
      { field: 'version', rejectedValue: 2, reason: 'Current version in database is 3' },
    ])
  })

  it('422: ném ApiError kèm cycleNodes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { status: 422, error: 'CYCLE_DETECTED', message: 'Phát hiện chu trình', cycleNodes: ['WPE-4', 'WPE-1'] }),
    )

    const error = await catchError(apiRequest('POST', '/projects/1/publish'))

    expect(error.status).toBe(422)
    expect(error.code).toBe('CYCLE_DETECTED')
    expect(error.cycleNodes).toEqual(['WPE-4', 'WPE-1'])
  })

  it('429: ném ApiError kèm retryAfterSeconds (từ body, hoặc từ header Retry-After)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { status: 429, error: 'COOLDOWN_ACTIVE', message: 'Chờ chút', retryAfterSeconds: 120 }),
    )
    const fromBody = await catchError(apiRequest('POST', '/projects/1/ai-diagnostics'))
    expect(fromBody.status).toBe(429)
    expect(fromBody.code).toBe('COOLDOWN_ACTIVE')
    expect(fromBody.retryAfterSeconds).toBe(120)

    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { status: 429, error: 'COOLDOWN_ACTIVE', message: 'Chờ chút' }, { 'Retry-After': '45' }),
    )
    const fromHeader = await catchError(apiRequest('POST', '/projects/1/ai-diagnostics'))
    expect(fromHeader.retryAfterSeconds).toBe(45)
  })

  it('lỗi không có body JSON: code = HTTP_<status>, có message mặc định', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }))

    const error = await catchError(apiRequest('GET', '/projects'))

    expect(error.status).toBe(502)
    expect(error.code).toBe('HTTP_502')
    expect(error.message).toContain('502')
  })

  it('204: trả undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    const result = await apiRequest('DELETE', '/projects/1/artifacts/2')

    expect(result).toBeUndefined()
  })

  it('lỗi mạng: ném ApiError status 0, code NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await catchError(apiRequest('GET', '/projects'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.isNetworkError).toBe(true)
  })

  it('401 có token: gọi unauthorized handler; handler trả true thì gửi lại đúng 1 lần với token mới', async () => {
    localStorage.setItem('wpe_auth_token', 'old-token')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { status: 401, error: 'TOKEN_EXPIRED', message: 'Hết hạn' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const handler = vi.fn(async (_ctx: UnauthorizedContext) => {
      localStorage.setItem('wpe_auth_token', 'new-token')
      return true
    })
    setUnauthorizedHandler(handler)

    const data = await apiRequest('GET', '/projects')

    expect(data).toEqual({ ok: true })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toMatchObject({ method: 'GET', path: '/projects', error: { code: 'TOKEN_EXPIRED' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentHeaders(fetchMock, 1)['Authorization']).toBe('Bearer new-token')
  })

  it('401 có token: handler trả false thì ném ApiError 401, không gửi lại', async () => {
    localStorage.setItem('wpe_auth_token', 'old-token')
    fetchMock.mockResolvedValue(jsonResponse(401, { status: 401, error: 'TOKEN_EXPIRED', message: 'Hết hạn' }))
    setUnauthorizedHandler(() => false)

    const error = await catchError(apiRequest('GET', '/projects'))

    expect(error.status).toBe(401)
    expect(error.code).toBe('TOKEN_EXPIRED')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('401 khi không gửi token: không gọi handler', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { status: 401, error: 'BAD_CREDENTIALS', message: 'Sai mật khẩu' }))
    const handler = vi.fn(() => true)
    setUnauthorizedHandler(handler)

    const error = await catchError(apiRequest('POST', '/auth/login', { body: { username: 'a', password: 'b' } }))

    expect(error.code).toBe('BAD_CREDENTIALS')
    expect(handler).not.toHaveBeenCalled()
  })
})
