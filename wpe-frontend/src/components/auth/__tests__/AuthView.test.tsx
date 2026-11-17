// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AuthView } from '../AuthView'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { ApiError } from '../../../services/http/ApiError'
import { getAuthErrorMessage } from '../../../services/impl/http/auth'

/**
 * A4 — Màn đăng nhập hiển thị lỗi theo ApiError.code (BAD_CREDENTIALS, ACCOUNT_LOCKED,
 * USERNAME_TAKEN, EMAIL_TAKEN) ngay trên form, không chỉ hiện message thô của backend.
 */

const envMock = vi.hoisted(() => ({ isMock: false }))
vi.mock('../../../services/env', () => ({
  get isMockMode() {
    return envMock.isMock
  },
}))

function apiError(status: number, code: string): ApiError {
  return new ApiError({ status, code, message: `backend: ${code}` })
}

function stubAuthAction(name: 'login' | 'register', error: ApiError) {
  const fn = vi.fn().mockRejectedValue(error)
  useWorkflowStore.setState((state) => ({ auth: { ...state.auth, [name]: fn } }))
  return fn
}

function fillAndSubmit(fields: Record<string, string>) {
  for (const [placeholder, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
  }
  const form = document.querySelector('form') as HTMLFormElement
  fireEvent.submit(form)
}

describe('AuthView: báo lỗi theo ApiError.code', () => {
  const originalAuth = useWorkflowStore.getState().auth

  beforeEach(() => {
    window.history.replaceState({}, '', '/auth?tab=signin')
  })

  afterEach(() => {
    cleanup()
    useWorkflowStore.setState({ auth: originalAuth })
  })

  it.each([
    ['BAD_CREDENTIALS', 401],
    ['ACCOUNT_LOCKED', 403],
  ])('đăng nhập lỗi %s: hiện câu báo lỗi tương ứng trên form', async (code, status) => {
    const login = stubAuthAction('login', apiError(status, code))
    render(<AuthView />)

    fillAndSubmit({ 'alex.kim@pipeline.engine': 'alex.kim@pipeline.engine', 'Enter your password': 'sai-mat-khau' })

    const expected = getAuthErrorMessage(apiError(status, code), '')
    await waitFor(() => expect(screen.getByText(expected)).toBeDefined())
    expect(login).toHaveBeenCalledWith({ identifier: 'alex.kim@pipeline.engine', password: 'sai-mat-khau', rememberMe: true })
  })

  it.each(['USERNAME_TAKEN', 'EMAIL_TAKEN'])('đăng ký lỗi %s: hiện câu báo lỗi tương ứng trên form', async (code) => {
    window.history.replaceState({}, '', '/auth?tab=signup')
    stubAuthAction('register', apiError(409, code))
    render(<AuthView />)

    fillAndSubmit({
      'Alex Kim': 'Marcus Liu',
      'alex.kim@pipeline.engine': 'marcus.liu@pipeline.engine',
      'At least 8 characters': 'password123',
      'Acme Engineering': 'Acme',
    })

    const expected = getAuthErrorMessage(apiError(409, code), '')
    await waitFor(() => expect(screen.getByText(expected)).toBeDefined())
  })

  it('đăng nhập thành công với vai trò USER -> điều hướng tới /workspaces', async () => {
    const login = vi.fn().mockImplementation(async () => {
      useWorkflowStore.setState((s) => ({
        auth: {
          ...s.auth,
          currentUser: { id: 2, username: 'alex.kim', email: 'alex.kim@pipeline.engine', systemRole: 'USER' },
        },
      }))
    })
    useWorkflowStore.setState((s) => ({ auth: { ...s.auth, login } }))
    render(<AuthView />)

    fillAndSubmit({ 'alex.kim@pipeline.engine': 'alex.kim@pipeline.engine', 'Enter your password': 'Password123!' })

    await waitFor(() => {
      expect(window.location.pathname).toBe('/workspaces')
    })
  })

  it('đăng nhập thành công với vai trò ADMIN -> điều hướng tới /admin', async () => {
    const login = vi.fn().mockImplementation(async () => {
      useWorkflowStore.setState((s) => ({
        auth: {
          ...s.auth,
          currentUser: { id: 1, username: 'admin', email: 'admin@pipeline.engine', systemRole: 'ADMIN' },
        },
      }))
    })
    useWorkflowStore.setState((s) => ({ auth: { ...s.auth, login } }))
    render(<AuthView />)

    fillAndSubmit({ 'alex.kim@pipeline.engine': 'admin@pipeline.engine', 'Enter your password': 'Password123!' })

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
  })

  it('G22: đăng nhập bằng username (không phải email) -> báo lỗi trên form, không gọi login', async () => {
    const login = vi.fn()
    useWorkflowStore.setState((s) => ({ auth: { ...s.auth, login } }))
    render(<AuthView />)

    fillAndSubmit({ 'alex.kim@pipeline.engine': 'alex.kim', 'Enter your password': 'Password123!' })

    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeDefined())
    expect(login).not.toHaveBeenCalled()
  })

  it('Forgot password?: ở chế độ thật (!isMockMode) hiện thông báo liên hệ admin', () => {
    envMock.isMock = false
    const showToast = vi.fn()
    useWorkflowStore.setState((s) => ({ ui: { ...s.ui, showToast } }))
    render(<AuthView />)

    fireEvent.click(screen.getByRole('button', { name: /Forgot password\?/i }))

    expect(showToast).toHaveBeenCalledWith(
      'Password reset by email is not available yet. Please contact your workspace administrator.',
    )
  })

  it('Forgot password?: ở chế độ mock (isMockMode) hiện thông báo demo', () => {
    envMock.isMock = true
    const showToast = vi.fn()
    useWorkflowStore.setState((s) => ({ ui: { ...s.ui, showToast } }))
    render(<AuthView />)

    fireEvent.click(screen.getByRole('button', { name: /Forgot password\?/i }))

    expect(showToast).toHaveBeenCalledWith('Password reset link sent (demo).')
  })
})
