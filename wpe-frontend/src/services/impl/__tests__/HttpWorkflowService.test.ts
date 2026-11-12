// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../HttpWorkflowService'

/**
 * A2 — HttpWorkflowService không được tự chuyển sang dữ liệu giả khi backend lỗi.
 * Phương thức đã có endpoint thật mà lỗi thì phải ném lỗi (ApiError) để UI hiện lỗi.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HttpWorkflowService: không còn fallback ngầm sang mock', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getMyTasks: mất kết nối backend thì ném lỗi NETWORK_ERROR, không trả dữ liệu giả', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const service = new HttpWorkflowService()

    await expect(service.getMyTasks('1', '2')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('getMyProjects: backend trả 500 thì ném lỗi kèm mã lỗi của body, không trả dữ liệu giả', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { status: 500, error: 'INTERNAL_SERVER_ERROR', message: 'Hệ thống gặp sự cố' }),
    )
    const service = new HttpWorkflowService()

    await expect(service.getMyProjects()).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Hệ thống gặp sự cố',
    })
  })

  it('getMacroPhases: backend trả 403 thì ném lỗi, không trả đồ thị giả', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { status: 403, error: 'ACCESS_DENIED', message: 'Không có quyền' }),
    )
    const service = new HttpWorkflowService()

    await expect(service.getMacroPhases('1')).rejects.toMatchObject({
      status: 403,
      code: 'ACCESS_DENIED',
    })
  })

  it('submitTaskArtifact: backend trả 409 thì ném lỗi, không giả vờ nộp thành công', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { status: 409, error: 'OPTIMISTIC_LOCK_CONFLICT', message: 'Xung đột dữ liệu' }),
    )
    const service = new HttpWorkflowService()

    await expect(
      service.submitTaskArtifact({ taskId: '5', type: 'LINK', url: 'https://x.dev', note: '' } as never),
    ).rejects.toMatchObject({ status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT' })
  })

  it('gọi đúng base URL chuẩn http://localhost:8080/api/v1 khi không đặt VITE_API_BASE_URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))
    const service = new HttpWorkflowService()

    await service.getMyTasks('1', '2')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:8080/api/v1/projects/1/my-tasks?userId=2')
  })

  it('publishPipeline: 422 vẫn trả kết quả chu trình (hành vi cũ giữ nguyên)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { status: 422, error: 'CYCLE_DETECTED', message: 'Có chu trình', cycleNodes: ['WPE-1', 'WPE-2'] }),
    )
    const service = new HttpWorkflowService()

    await expect(service.publishPipeline('1')).resolves.toEqual({
      success: false,
      cycleDetected: true,
      violatingNodeIds: ['WPE-1', 'WPE-2'],
    })
  })

  it('publishPipeline: mất kết nối thì ném lỗi, không giả vờ xuất bản thành công', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const service = new HttpWorkflowService()

    await expect(service.publishPipeline('1')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})

describe('HttpWorkflowService: auth gọi backend thật (A4)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('login, register, getCurrentUser, logout không còn nằm trong METHODS_STILL_MOCKED', () => {
    const list: readonly string[] = METHODS_STILL_MOCKED
    for (const name of ['login', 'register', 'getCurrentUser', 'logout']) {
      expect(list).not.toContain(name)
    }
  })

  it('login gọi POST /auth/login và lỗi BAD_CREDENTIALS thì ném ApiError (không trả phiên giả)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { status: 401, error: 'BAD_CREDENTIALS', message: 'Sai mật khẩu' }),
    )
    const service = new HttpWorkflowService()

    await expect(
      service.login({ identifier: 'alex.kim', password: 'sai', rememberMe: true }),
    ).rejects.toMatchObject({ status: 401, code: 'BAD_CREDENTIALS' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/auth/login')
  })

  it('register gọi POST /auth/register', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { status: 409, error: 'EMAIL_TAKEN', message: 'Email đã dùng' }),
    )
    const service = new HttpWorkflowService()

    await expect(
      service.register({ fullName: 'A B', email: 'ab.c@x.io', password: 'password123', workspaceName: 'W' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/auth/register')
  })

  it('getCurrentUser trả user đã lưu khi đăng nhập (wpe_auth_user), không gọi mock', async () => {
    sessionStorage.setItem('wpe_auth_token', 'jwt')
    sessionStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '2', username: 'sarah.chen', email: 's@x.io', systemRole: 'USER' }),
    )
    const service = new HttpWorkflowService()

    await expect(service.getCurrentUser()).resolves.toMatchObject({ id: '2', username: 'sarah.chen' })
  })

  it('getCurrentUser khi chưa đăng nhập thì ném ApiError 401', async () => {
    const service = new HttpWorkflowService()

    await expect(service.getCurrentUser()).rejects.toMatchObject({ status: 401 })
  })

  it('logout gọi POST /auth/logout kèm refreshToken đang lưu', async () => {
    localStorage.setItem('wpe_auth_token', 'jwt')
    localStorage.setItem('wpe_refresh_token', 'rt_5')
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }))
    const service = new HttpWorkflowService()

    await service.logout()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8080/api/v1/auth/logout')
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'rt_5' })
  })
})
