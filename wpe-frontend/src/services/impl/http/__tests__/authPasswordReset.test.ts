// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPasswordResetStatus,
  requestPasswordReset,
  verifyPasswordResetToken,
  resetPassword,
} from '../auth'

/** TASK_61 — 4 hàm quên mật khẩu gọi đúng method/path/body; chế độ demo không gọi mạng. */

const envMock = vi.hoisted(() => ({ isMock: false }))
vi.mock('../../../env', () => ({
  get isMockMode() {
    return envMock.isMock
  },
}))

const BASE = 'http://localhost:8080/api/v1'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('auth: quên mật khẩu (chế độ thật)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    envMock.isMock = false
    fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { enabled: true, success: true, valid: true }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getPasswordResetStatus: GET /auth/password-reset/status', async () => {
    await expect(getPasswordResetStatus()).resolves.toMatchObject({ enabled: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/password-reset/status`)
    expect(init.method).toBe('GET')
  })

  it('requestPasswordReset: POST /auth/forgot-password { email }', async () => {
    await requestPasswordReset(' a@b.co ')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/forgot-password`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.co' })
  })

  it('verifyPasswordResetToken: POST /auth/reset-password/verify { token }', async () => {
    await verifyPasswordResetToken('tok123')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/reset-password/verify`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok123' })
  })

  it('resetPassword: POST /auth/reset-password { token, newPassword }', async () => {
    await resetPassword('tok123', 'Newpass123')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/auth/reset-password`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok123', newPassword: 'Newpass123' })
  })

  it('lỗi backend được ném ra dạng ApiError có code', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { status: 400, error: 'INVALID_RESET_TOKEN', message: 'bad', path: '/x' }),
    )
    await expect(verifyPasswordResetToken('x')).rejects.toMatchObject({ status: 400, code: 'INVALID_RESET_TOKEN' })
  })
})

describe('auth: quên mật khẩu (chế độ demo)', () => {
  it('giả lập thành công, không gọi mạng', async () => {
    envMock.isMock = true
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPasswordResetStatus()).resolves.toEqual({ enabled: true })
    await expect(requestPasswordReset('a@b.co')).resolves.toBeUndefined()
    await expect(verifyPasswordResetToken('any')).resolves.toBeUndefined()
    await expect(resetPassword('any', 'Newpass123')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
