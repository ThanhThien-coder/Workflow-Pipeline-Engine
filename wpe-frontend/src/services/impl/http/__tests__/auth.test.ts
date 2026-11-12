// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, setUnauthorizedHandler } from '../../../http/apiClient'
import { ApiError } from '../../../http/ApiError'
import {
  REFRESH_TOKEN_KEY,
  login,
  register,
  logout,
  getStoredUser,
  saveSession,
  installAuthRefresh,
  getAuthErrorMessage,
  usernameFromEmail,
} from '../auth'

/**
 * A4 — Gọi /auth/* thật và tự làm mới token khi gặp 401.
 * fetch được giả lập, không cần backend.
 */

const BASE = 'http://localhost:8080/api/v1'

const BACKEND_USER = {
  id: '1',
  username: 'alex.kim',
  email: 'alex.kim@pipeline.engine',
  name: 'Alex Kim',
  role: 'ADMIN',
  avatarUrl: null,
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorBody(status: number, error: string, message = error) {
  return { timestamp: '2026-11-12T00:00:00Z', status, error, message, path: '/api/v1/x' }
}

function authBody(token: string, refreshToken: string) {
  return { token, refreshToken, user: BACKEND_USER }
}

type FetchCall = [string, RequestInit]

function callsTo(fetchMock: ReturnType<typeof vi.fn>, suffix: string): FetchCall[] {
  return (fetchMock.mock.calls as FetchCall[]).filter(([url]) => url.startsWith(`${BASE}${suffix}`))
}

function bodyOf(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call[1].body))
}

function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>)['Authorization']
}

/** Lưu một phiên đang đăng nhập (giống sau khi login). */
function seedSession(storage: Storage, token = 'old', refreshToken = 'rt_1') {
  storage.setItem('wpe_auth_token', token)
  storage.setItem('wpe_auth_user', JSON.stringify({ id: '1', username: 'alex.kim', email: 'a@b.c', systemRole: 'ADMIN' }))
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

describe('auth.ts: login, register, logout, getStoredUser', () => {
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

  it('login đúng: POST /auth/login {username, password, rememberMe} và đổi AuthResponse sang AuthResponseDto', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, authBody('jwt-1', 'rt_1')))

    const res = await login({ identifier: ' alex.kim ', password: 'Password123!', rememberMe: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as FetchCall
    expect(url).toBe(`${BASE}/auth/login`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ username: 'alex.kim', password: 'Password123!', rememberMe: true })
    expect(res.accessToken).toBe('jwt-1')
    expect(res.refreshToken).toBe('rt_1')
    expect(res.tokenType).toBe('Bearer')
    expect(res.user).toMatchObject({ id: '1', username: 'alex.kim', email: 'alex.kim@pipeline.engine', systemRole: 'ADMIN', name: 'Alex Kim' })
  })

  it('login sai: 401 BAD_CREDENTIALS thì ném ApiError có code BAD_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody(401, 'BAD_CREDENTIALS', 'Sai tên đăng nhập hoặc mật khẩu')))

    await expect(login({ identifier: 'alex.kim', password: 'sai', rememberMe: false })).rejects.toMatchObject({
      status: 401,
      code: 'BAD_CREDENTIALS',
    })
  })

  it('login bị khóa: 403 ACCOUNT_LOCKED thì ném ApiError có code ACCOUNT_LOCKED', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, errorBody(403, 'ACCOUNT_LOCKED')))

    await expect(login({ identifier: 'locked.user', password: 'x', rememberMe: false })).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_LOCKED',
    })
  })

  it('login còn token cũ trong máy mà bị 401: KHÔNG gọi /auth/refresh (tránh vòng lặp)', async () => {
    seedSession(localStorage, 'stale', 'rt_stale')
    installAuthRefresh(() => {})
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody(401, 'BAD_CREDENTIALS')))

    await expect(login({ identifier: 'alex.kim', password: 'sai', rememberMe: true })).rejects.toMatchObject({
      code: 'BAD_CREDENTIALS',
    })
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(0)
  })

  it('register: gửi username lấy từ email, fullName; 409 EMAIL_TAKEN / USERNAME_TAKEN ném đúng code', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(409, errorBody(409, 'EMAIL_TAKEN')))
      .mockResolvedValueOnce(jsonResponse(409, errorBody(409, 'USERNAME_TAKEN')))
    const cmd = { fullName: 'Marcus Liu', email: 'Marcus.Liu@pipeline.engine', password: 'password123', workspaceName: 'Acme' }

    await expect(register(cmd)).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' })
    await expect(register(cmd)).rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' })

    const [url, init] = fetchMock.mock.calls[0] as FetchCall
    expect(url).toBe(`${BASE}/auth/register`)
    expect(JSON.parse(String(init.body))).toEqual({
      username: 'marcus.liu',
      email: 'Marcus.Liu@pipeline.engine',
      password: 'password123',
      fullName: 'Marcus Liu',
    })
  })

  it('register thành công: 201 trả AuthResponseDto có refreshToken', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, authBody('jwt-new', 'rt_new')))

    const res = await register({ fullName: 'Alex Kim', email: 'alex.kim@x.io', password: 'password123', workspaceName: 'W' })

    expect(res.accessToken).toBe('jwt-new')
    expect(res.refreshToken).toBe('rt_new')
  })

  it('usernameFromEmail: lấy phần trước @, viết thường, bỏ ký tự lạ, tối đa 50 ký tự', () => {
    expect(usernameFromEmail('Alex.Kim@pipeline.engine')).toBe('alex.kim')
    expect(usernameFromEmail('a+b c@x.io')).toBe('abc')
    expect(usernameFromEmail(`${'x'.repeat(60)}@x.io`)).toHaveLength(50)
  })

  it('logout: POST /auth/logout gửi refreshToken đang lưu', async () => {
    seedSession(sessionStorage, 'jwt', 'rt_9')
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }))

    await logout()

    const calls = callsTo(fetchMock, '/auth/logout')
    expect(calls).toHaveLength(1)
    expect(bodyOf(calls[0])).toEqual({ refreshToken: 'rt_9' })
  })

  it('saveSession: rememberMe=true lưu localStorage, false lưu sessionStorage (kèm wpe_refresh_token)', () => {
    const dto = { accessToken: 'jwt', refreshToken: 'rt_1', tokenType: 'Bearer' as const, expiresAt: '', user: { id: '1', username: 'a', email: 'a@b.c', systemRole: 'USER' as const } }

    saveSession(dto, true)
    expect(localStorage.getItem('wpe_auth_token')).toBe('jwt')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rt_1')
    expect(sessionStorage.getItem('wpe_auth_token')).toBeNull()

    saveSession(dto, false)
    expect(sessionStorage.getItem('wpe_auth_token')).toBe('jwt')
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rt_1')
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })

  it('getStoredUser: trả user đã lưu khi đăng nhập (wpe_auth_user), chưa đăng nhập thì null', () => {
    expect(getStoredUser()).toBeNull()
    seedSession(sessionStorage)
    expect(getStoredUser()).toMatchObject({ id: '1', username: 'alex.kim' })
  })

  it('getAuthErrorMessage: có câu riêng cho BAD_CREDENTIALS, ACCOUNT_LOCKED, USERNAME_TAKEN, EMAIL_TAKEN', () => {
    const codes = ['BAD_CREDENTIALS', 'ACCOUNT_LOCKED', 'USERNAME_TAKEN', 'EMAIL_TAKEN']
    const messages = codes.map((code) =>
      getAuthErrorMessage(new ApiError({ status: 400, code, message: 'backend-message' }), 'fallback'),
    )
    for (const m of messages) {
      expect(m).not.toBe('backend-message')
      expect(m).not.toBe('fallback')
    }
    expect(new Set(messages).size).toBe(4)
    expect(getAuthErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
    expect(getAuthErrorMessage('???', 'fallback')).toBe('fallback')
  })
})

describe('auth.ts: tự làm mới token khi gặp 401 (single-flight)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let onExpired: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    onExpired = vi.fn()
    installAuthRefresh(onExpired)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  /** API nghiệp vụ: token 'old' bị 401 TOKEN_EXPIRED, token khác thì 200. */
  function businessApi(url: string, init: RequestInit): Response | null {
    if (url.startsWith(`${BASE}/auth/`)) return null
    if (authHeader(init) === 'Bearer old') return jsonResponse(401, errorBody(401, 'TOKEN_EXPIRED'))
    return jsonResponse(200, { url, auth: authHeader(init) })
  }

  it('refresh thành công: gọi /auth/refresh 1 lần, lưu đè token + refreshToken mới, gửi lại request gốc 1 lần', async () => {
    seedSession(localStorage, 'old', 'rt_1')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) return jsonResponse(200, authBody('new', 'rt_2'))
      return businessApi(url, init)
    })

    const data = await apiRequest<{ auth: string }>('GET', '/projects')

    expect(data.auth).toBe('Bearer new')
    const refreshCalls = callsTo(fetchMock, '/auth/refresh')
    expect(refreshCalls).toHaveLength(1)
    expect(bodyOf(refreshCalls[0])).toEqual({ refreshToken: 'rt_1' })
    // Lưu đè vào đúng storage đang giữ phiên (rememberMe = true -> localStorage)
    expect(localStorage.getItem('wpe_auth_token')).toBe('new')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rt_2')
    expect(sessionStorage.getItem('wpe_auth_token')).toBeNull()
    expect(callsTo(fetchMock, '/projects')).toHaveLength(2)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('refresh thành công với phiên sessionStorage: token mới lưu vào sessionStorage', async () => {
    seedSession(sessionStorage, 'old', 'rt_1')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) return jsonResponse(200, authBody('new', 'rt_2'))
      return businessApi(url, init)
    })

    await apiRequest('GET', '/projects')

    expect(sessionStorage.getItem('wpe_auth_token')).toBe('new')
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rt_2')
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
  })

  it('refresh thất bại (401 REFRESH_TOKEN_REUSED): xóa phiên, gọi onSessionExpired 1 lần, ném 401 gốc, không lặp', async () => {
    seedSession(localStorage, 'old', 'rt_1')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) return jsonResponse(401, errorBody(401, 'REFRESH_TOKEN_REUSED'))
      return businessApi(url, init)
    })

    await expect(apiRequest('GET', '/projects')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' })

    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1)
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
    expect(localStorage.getItem('wpe_auth_user')).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })

  it('3 request cùng bị 401 một lúc: chỉ đúng 1 lời gọi /auth/refresh, cả 3 gửi lại với token mới', async () => {
    seedSession(localStorage, 'old', 'rt_1')
    let releaseRefresh: () => void = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) {
        await refreshGate
        // Backend thật: refresh token dùng 1 lần, lần thứ 2 bị REFRESH_TOKEN_REUSED.
        return callsTo(fetchMock, '/auth/refresh').length === 1
          ? jsonResponse(200, authBody('new', 'rt_2'))
          : jsonResponse(401, errorBody(401, 'REFRESH_TOKEN_REUSED'))
      }
      return businessApi(url, init)
    })

    const all = Promise.all([
      apiRequest<{ auth: string }>('GET', '/projects'),
      apiRequest<{ auth: string }>('GET', '/notifications'),
      apiRequest<{ auth: string }>('GET', '/users/me/profile'),
    ])
    // Chờ cả 3 request nhận 401 và đang đợi refresh
    await vi.waitFor(() => expect(callsTo(fetchMock, '/auth/refresh').length).toBeGreaterThanOrEqual(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    releaseRefresh()
    const results = await all

    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1)
    expect(results.map((r) => r.auth)).toEqual(['Bearer new', 'Bearer new', 'Bearer new'])
    expect(onExpired).not.toHaveBeenCalled()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rt_2')
  })

  it('401 về muộn (gửi bằng token cũ, refresh đã xong trước đó): không refresh lần 2, gửi lại bằng token mới', async () => {
    seedSession(localStorage, 'old', 'rt_1')
    let releaseSlow: () => void = () => {}
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) return jsonResponse(200, authBody('new', 'rt_2'))
      if (url === `${BASE}/slow` && authHeader(init) === 'Bearer old') await slowGate
      return businessApi(url, init)
    })

    const slow = apiRequest<{ auth: string }>('GET', '/slow')
    await apiRequest('GET', '/projects') // refresh xong ở đây
    releaseSlow()
    const result = await slow

    expect(result.auth).toBe('Bearer new')
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1)
  })

  it('3 request cùng 401 mà refresh thất bại: 1 lời gọi refresh, onSessionExpired chỉ 1 lần', async () => {
    seedSession(localStorage, 'old', 'rt_1')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return jsonResponse(401, errorBody(401, 'INVALID_REFRESH_TOKEN'))
      }
      return businessApi(url, init)
    })

    const results = await Promise.allSettled([
      apiRequest('GET', '/projects'),
      apiRequest('GET', '/notifications'),
      apiRequest('GET', '/users/me/profile'),
    ])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1)
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('không có refresh token trong máy: không gọi /auth/refresh, xóa phiên và báo hết hạn', async () => {
    localStorage.setItem('wpe_auth_token', 'old')
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => businessApi(url, init))

    await expect(apiRequest('GET', '/projects')).rejects.toMatchObject({ status: 401 })

    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(0)
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
  })
})
