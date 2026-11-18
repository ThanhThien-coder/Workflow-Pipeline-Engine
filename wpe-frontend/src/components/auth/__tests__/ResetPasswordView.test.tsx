// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ResetPasswordView } from '../ResetPasswordView'

/** TASK_61 — Trang /reset-password: token từ #hash, verify, kiểm mật khẩu phía client, gửi đặt lại. */

const envMock = vi.hoisted(() => ({ isMock: false }))
vi.mock('../../../services/env', () => ({
  get isMockMode() {
    return envMock.isMock
  },
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const err = (status: number, code: string, message = code) =>
  json(status, { status, error: code, message, path: '/x' })

type Handler = (url: string, body: Record<string, unknown>) => Response

function mockFetch(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    handler(url, init?.body ? JSON.parse(String(init.body)) : {}),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const callsTo = (fetchMock: ReturnType<typeof vi.fn>, suffix: string) =>
  (fetchMock.mock.calls as [string, RequestInit][]).filter(([u]) => u.endsWith(suffix))

function fillAndSubmit(pw: string, confirm: string) {
  fireEvent.change(screen.getByPlaceholderText('Enter a new password'), { target: { value: pw } })
  fireEvent.change(screen.getByPlaceholderText('Repeat the new password'), { target: { value: confirm } })
  fireEvent.submit(document.querySelector('form') as HTMLFormElement)
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    envMock.isMock = false
    window.history.replaceState({}, '', '/reset-password#token=abc123')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('đọc token từ hash, gửi verify rồi xóa token khỏi URL', async () => {
    const fetchMock = mockFetch(() => json(200, { valid: true }))
    render(<ResetPasswordView />)

    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())
    expect(JSON.parse(String(callsTo(fetchMock, '/auth/reset-password/verify')[0][1].body))).toEqual({ token: 'abc123' })
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/reset-password')
  })

  it('không có token: hiện trạng thái link không hợp lệ, không gọi API', async () => {
    window.history.replaceState({}, '', '/reset-password')
    const fetchMock = mockFetch(() => json(200, {}))
    render(<ResetPasswordView />)

    expect(document.body.textContent).toContain('This password reset link is invalid or has expired.')
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('token sai/hết hạn (INVALID_RESET_TOKEN): hiện trạng thái không hợp lệ', async () => {
    mockFetch(() => err(400, 'INVALID_RESET_TOKEN'))
    render(<ResetPasswordView />)

    await waitFor(() =>
      expect(document.body.textContent).toContain('This password reset link is invalid or has expired.'),
    )
    expect(document.querySelector('form')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }))
    expect(window.location.search).toBe('?tab=forgot')
  })

  it('mật khẩu thiếu chữ số hoặc quá ngắn: báo lỗi, không gọi API đặt lại', async () => {
    const fetchMock = mockFetch(() => json(200, { valid: true }))
    render(<ResetPasswordView />)
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())

    fillAndSubmit('abcdefgh', 'abcdefgh')
    await waitFor(() =>
      expect(screen.getByText('Use at least 8 characters, including a number.')).toBeDefined(),
    )
    fillAndSubmit('a1', 'a1')
    await waitFor(() =>
      expect(screen.getByText('Use at least 8 characters, including a number.')).toBeDefined(),
    )
    expect(callsTo(fetchMock, '/auth/reset-password')).toHaveLength(0)
  })

  it('hai ô không khớp: báo lỗi, không gọi API đặt lại', async () => {
    const fetchMock = mockFetch(() => json(200, { valid: true }))
    render(<ResetPasswordView />)
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())

    fillAndSubmit('Password123', 'Password124')

    await waitFor(() => expect(screen.getByText("Passwords don't match.")).toBeDefined())
    expect(callsTo(fetchMock, '/auth/reset-password')).toHaveLength(0)
  })

  it('thành công: gửi token + mật khẩu mới và hiện trạng thái đã cập nhật', async () => {
    const fetchMock = mockFetch((url) =>
      url.endsWith('/auth/reset-password') ? json(200, { success: true, message: 'ok' }) : json(200, { valid: true }),
    )
    render(<ResetPasswordView />)
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())

    fillAndSubmit('Password123', 'Password123')

    await waitFor(() => expect(screen.getByText('Your password has been updated')).toBeDefined())
    expect(document.body.textContent).toContain('All other sessions have been signed out.')
    expect(JSON.parse(String(callsTo(fetchMock, '/auth/reset-password')[0][1].body))).toEqual({
      token: 'abc123',
      newPassword: 'Password123',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(window.location.search).toBe('?tab=signin')
  })

  it('WEAK_PASSWORD: hiện message của backend dưới ô mật khẩu', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/reset-password') ? err(400, 'WEAK_PASSWORD', 'Backend says: too weak') : json(200, { valid: true }),
    )
    render(<ResetPasswordView />)
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())

    fillAndSubmit('Password123', 'Password123')

    await waitFor(() => expect(screen.getByText('Backend says: too weak')).toBeDefined())
    expect(screen.queryByText('Your password has been updated')).toBeNull()
  })

  it('INVALID_RESET_TOKEN khi gửi: chuyển sang trạng thái link không hợp lệ', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/reset-password') ? err(400, 'INVALID_RESET_TOKEN') : json(200, { valid: true }),
    )
    render(<ResetPasswordView />)
    await waitFor(() => expect(screen.getByText('Choose a new password')).toBeDefined())

    fillAndSubmit('Password123', 'Password123')

    await waitFor(() =>
      expect(document.body.textContent).toContain('This password reset link is invalid or has expired.'),
    )
  })
})
