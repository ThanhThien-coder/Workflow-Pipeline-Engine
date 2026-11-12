// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * A4 — authSlice khi chạy với backend thật (HttpWorkflowService), fetch được giả lập.
 * container mặc định là mock trong test (VITE_USE_MOCK=true), nên thay workflowService bằng bản Http.
 */
vi.mock('../../../services/container', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../services/container')>()
  const { HttpWorkflowService } = await import('../../../services/impl/HttpWorkflowService')
  const workflowService = new HttpWorkflowService()
  return { ...original, workflowService, container: { ...original.container, workflowService } }
})

import { createWorkflowStore } from '../../useWorkflowStore'
import { useProfileStore } from '../../useProfileStore'
import { useNotificationStore } from '../../useNotificationStore'
import { apiRequest, setUnauthorizedHandler } from '../../../services/http/apiClient'
import type { ProfileDto } from '../../../types/profile.types'
import type { NotificationDto } from '../../../types/notification.types'

const BASE = 'http://localhost:8080/api/v1'

const ALEX = {
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

function errorBody(status: number, error: string) {
  return { timestamp: '2026-11-12T00:00:00Z', status, error, message: `backend: ${error}`, path: '/api/v1/x' }
}

type FetchCall = [string, RequestInit]

describe('authSlice với backend thật (A4)', () => {
  let store: ReturnType<typeof createWorkflowStore>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    store = createWorkflowStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  async function loginAlex(rememberMe = true) {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-alex', refreshToken: 'rt_alex', user: ALEX }))
    await store.getState().auth.login({ identifier: 'alex.kim', password: 'Password123!', rememberMe })
  }

  /** Giả lập dữ liệu của alex còn nằm trong các store sau khi dùng app. */
  function fillUserData() {
    store.setState((state) => ({
      currentProjectId: 'p-alex',
      macroPhases: [{ id: 'ph-alex' } as never],
      workflowEdges: [['a', 'b']],
      selectedPhaseId: 'ph-alex',
      trees: { 'ph-alex': {} },
      workspace: { ...state.workspace, projects: [{ id: 'p-alex', name: 'Core Banking Pipeline' } as never], q: 'core' },
      kanban: { ...state.kanban, tasks: [{ id: 't-alex' } as never], members: [{ id: '1' } as never] },
      settings: { ...state.settings, members: [{ userId: '1', username: 'alex.kim' } as never], auditLogs: [{ id: 'log' } as never] },
      overview: { ...state.overview, data: { project: { id: 'p-alex' } } as never },
      artifacts: { ...state.artifacts, items: [{ id: 'art-alex' } as never] },
    }))
    useProfileStore.setState({ profile: { username: 'alex.kim' } as unknown as ProfileDto })
    useNotificationStore.setState({ items: [{ id: 'n-alex', isRead: false } as unknown as NotificationDto], unreadCount: 1 })
  }

  function expectUserDataCleared() {
    const s = store.getState()
    expect(s.currentProjectId).toBeNull()
    expect(s.macroPhases).toEqual([])
    expect(s.workflowEdges).toEqual([])
    expect(s.selectedPhaseId).toBeNull()
    expect(s.trees).toEqual({})
    expect(s.workspace.projects).toEqual([])
    expect(s.workspace.q).toBe('')
    expect(s.kanban.tasks).toEqual([])
    expect(s.kanban.members).toEqual([])
    expect(s.settings.members).toEqual([])
    expect(s.settings.auditLogs).toEqual([])
    expect(s.overview.data).toBeNull()
    expect(s.artifacts.items.some((a) => a.id === 'art-alex')).toBe(false)
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useNotificationStore.getState().items).toEqual([])
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  }

  function expectStorageCleared() {
    for (const key of ['wpe_auth_token', 'wpe_auth_user', 'wpe_refresh_token']) {
      expect(localStorage.getItem(key)).toBeNull()
      expect(sessionStorage.getItem(key)).toBeNull()
    }
  }

  it('login rememberMe=true: lưu token, user, refresh token vào localStorage', async () => {
    await loginAlex(true)

    const auth = store.getState().auth
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe('jwt-alex')
    expect(auth.currentUser).toMatchObject({ id: '1', username: 'alex.kim', systemRole: 'ADMIN' })
    expect(localStorage.getItem('wpe_auth_token')).toBe('jwt-alex')
    expect(localStorage.getItem('wpe_refresh_token')).toBe('rt_alex')
    expect(JSON.parse(localStorage.getItem('wpe_auth_user') ?? '{}')).toMatchObject({ username: 'alex.kim' })
    expect(sessionStorage.getItem('wpe_auth_token')).toBeNull()
    expect(store.getState().kanban.currentUserId).toBe('1')
  })

  it('login rememberMe=false: lưu vào sessionStorage, localStorage trống', async () => {
    await loginAlex(false)

    expect(sessionStorage.getItem('wpe_auth_token')).toBe('jwt-alex')
    expect(sessionStorage.getItem('wpe_refresh_token')).toBe('rt_alex')
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
    expect(localStorage.getItem('wpe_refresh_token')).toBeNull()
  })

  it('login sai: auth.error là câu báo lỗi theo mã BAD_CREDENTIALS, không phải message thô của backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, errorBody(401, 'BAD_CREDENTIALS')))

    await expect(
      store.getState().auth.login({ identifier: 'alex.kim', password: 'sai', rememberMe: true }),
    ).rejects.toMatchObject({ code: 'BAD_CREDENTIALS' })

    const auth = store.getState().auth
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.error).toBeTruthy()
    expect(auth.error).not.toBe('backend: BAD_CREDENTIALS')
  })

  it('đăng xuất: gọi /auth/logout kèm refresh token (trước khi xóa), xóa phiên, reset store', async () => {
    await loginAlex(true)
    fillUserData()
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true }))

    await store.getState().auth.logout()

    const logoutCalls = (fetchMock.mock.calls as FetchCall[]).filter(([url]) => url === `${BASE}/auth/logout`)
    expect(logoutCalls).toHaveLength(1)
    expect(JSON.parse(String(logoutCalls[0][1].body))).toEqual({ refreshToken: 'rt_alex' })
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(store.getState().auth.currentUser).toBeNull()
    expectStorageCleared()
    expectUserDataCleared()
  })

  it('đăng xuất khi mất mạng: vẫn xóa phiên trên máy và reset store', async () => {
    await loginAlex(false)
    fillUserData()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await store.getState().auth.logout()

    expect(store.getState().auth.isAuthenticated).toBe(false)
    expectStorageCleared()
    expectUserDataCleared()
  })

  it('refresh thất bại: xóa phiên, reset store, về trạng thái chưa đăng nhập, toast "Phiên đăng nhập đã hết hạn"', async () => {
    await loginAlex(true)
    fillUserData()
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${BASE}/auth/refresh`) return jsonResponse(401, errorBody(401, 'INVALID_REFRESH_TOKEN'))
      return jsonResponse(401, errorBody(401, 'TOKEN_EXPIRED'))
    })

    await expect(apiRequest('GET', '/projects')).rejects.toMatchObject({ status: 401 })

    const s = store.getState()
    expect(s.auth.isAuthenticated).toBe(false)
    expect(s.auth.token).toBeNull()
    expect(s.ui.toast?.message).toBe('Phiên đăng nhập đã hết hạn')
    expectStorageCleared()
    expectUserDataCleared()
  })

  it('refresh thành công: auth.token trong store được cập nhật token mới', async () => {
    await loginAlex(true)
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === `${BASE}/auth/refresh`) {
        return jsonResponse(200, { token: 'jwt-alex-2', refreshToken: 'rt_alex_2', user: ALEX })
      }
      const auth = (init.headers as Record<string, string>)['Authorization']
      return auth === 'Bearer jwt-alex' ? jsonResponse(401, errorBody(401, 'TOKEN_EXPIRED')) : jsonResponse(200, [])
    })

    await apiRequest('GET', '/projects')

    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(store.getState().auth.token).toBe('jwt-alex-2')
  })
})
