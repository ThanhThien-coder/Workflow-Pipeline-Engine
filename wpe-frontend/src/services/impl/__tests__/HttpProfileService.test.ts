// @vitest-environment jsdom
import { createElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpWorkflowService } from '../HttpWorkflowService'
import { saveSession } from '../http/auth'
import { isApiError } from '../../http/ApiError'
import { createWorkflowStore, useWorkflowStore } from '../../../store/useWorkflowStore'
import { useProfileStore } from '../../../store/useProfileStore'
import { GlobalProfileMenu } from '../../../components/common/GlobalProfileMenu'

vi.mock('../../container', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../container')>()
  const { HttpWorkflowService: HttpWf } = await import('../HttpWorkflowService')
  const workflowService = new HttpWf()
  let profileService = original.profileService
  try {
    const mod = await import('../HttpProfileService')
    if (mod?.HttpProfileService) {
      profileService = new mod.HttpProfileService()
    }
  } catch {
    // Chưa có HttpProfileService trước khi sửa
  }
  return {
    ...original,
    workflowService,
    profileService,
    container: {
      ...original.container,
      workflowService,
      profileService,
    },
  }
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const USER_A = {
  id: '101',
  username: 'meo',
  email: 'meo@pipeline.engine',
  name: 'Mèo Con',
  role: 'USER' as const,
  avatarUrl: 'https://example.com/meo.png',
}

const USER_B = {
  id: '202',
  username: 'alex.kim',
  email: 'alex.kim@pipeline.engine',
  name: null,
  role: 'ADMIN' as const,
  avatarUrl: null,
}

describe('FC1: HttpProfileService & đổi tài khoản không dính hồ sơ người trước', () => {
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

  it('HttpProfileService.getMyProfile trả đúng user đang lưu (name || username) và ném lỗi khi chưa đăng nhập', async () => {
    const { HttpProfileService } = await import('../HttpProfileService')
    const service = new HttpProfileService()

    await expect(service.getMyProfile()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })

    saveSession(
      {
        accessToken: 'jwt-a',
        refreshToken: 'rt-a',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: USER_A.id,
          username: USER_A.username,
          email: USER_A.email,
          name: USER_A.name,
          systemRole: USER_A.role,
          avatarUrl: USER_A.avatarUrl,
        },
      },
      true,
    )

    const profileA = await service.getMyProfile()
    expect(profileA.userId).toBe('101')
    expect(profileA.displayName).toBe('Mèo Con')
    expect(profileA.email).toBe('meo@pipeline.engine')
    expect(profileA.avatarUrl).toBe('https://example.com/meo.png')

    saveSession(
      {
        accessToken: 'jwt-b',
        refreshToken: 'rt-b',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: USER_B.id,
          username: USER_B.username,
          email: USER_B.email,
          name: USER_B.name,
          systemRole: USER_B.role,
          avatarUrl: USER_B.avatarUrl,
        },
      },
      false,
    )

    const profileB = await service.getMyProfile()
    expect(profileB.userId).toBe('202')
    expect(profileB.displayName).toBe('alex.kim')
    expect(profileB.email).toBe('alex.kim@pipeline.engine')
    expect(profileB.avatarUrl).toBeNull()
  })

  it('Các phương thức ghi của HttpProfileService ném ApiError "Tính năng chưa hỗ trợ"', async () => {
    const { HttpProfileService } = await import('../HttpProfileService')
    const service = new HttpProfileService()
    const dummyFile = new File(['x'], 'a.png', { type: 'image/png' })

    const calls = [
      () =>
        service.updateProfile({
          displayName: 'New',
          email: 'new@x.io',
          title: 'Dev',
          bio: '',
          skills: [],
          links: { github: '', linkedin: '', website: '' },
        }),
      () => service.uploadAvatar(dummyFile),
      () => service.removeAvatar(),
      () => service.changePassword({ currentPassword: 'old', newPassword: 'newpassword1' }),
      () => service.setProjectPublic('1', true),
      () => service.updatePrivacy({ visibility: 'public', showEmail: true, showStats: true }),
      () => service.deactivateAccount(),
      () => service.deleteAccount({ confirmation: 'DELETE' }),
    ]

    for (const fn of calls) {
      let caught: unknown
      try {
        await fn()
      } catch (err) {
        caught = err
      }
      expect(isApiError(caught)).toBe(true)
      expect((caught as Error).message).toContain('Tính năng chưa hỗ trợ')
    }
  })

  it('Đăng nhập A → profile A; đăng xuất, đăng nhập B (hoặc đăng nhập đè B) → profile B (không còn A)', async () => {
    const store = createWorkflowStore(new HttpWorkflowService())

    // 1. Đăng nhập A
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-a', refreshToken: 'rt-a', user: USER_A }))
    await store.getState().auth.login({ identifier: 'meo', password: 'Password123!', rememberMe: true })

    const loadedA = await useProfileStore.getState().loadProfile()
    expect(loadedA.displayName).toBe('Mèo Con')
    expect(loadedA.email).toBe('meo@pipeline.engine')
    expect(useProfileStore.getState().profile?.displayName).toBe('Mèo Con')

    // 2. Đăng xuất A -> profile bị xóa
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true }))
    await store.getState().auth.logout()
    expect(useProfileStore.getState().profile).toBeNull()

    // 3. Đăng nhập B -> profile B (không còn A)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-b', refreshToken: 'rt-b', user: USER_B }))
    await store.getState().auth.login({ identifier: 'alex.kim', password: 'Password123!', rememberMe: true })
    expect(useProfileStore.getState().profile).toBeNull()

    const loadedB = await useProfileStore.getState().loadProfile()
    expect(loadedB.displayName).toBe('alex.kim')
    expect(loadedB.email).toBe('alex.kim@pipeline.engine')
    expect(useProfileStore.getState().profile?.displayName).toBe('alex.kim')

    // 4. Đăng nhập lại A trực tiếp (reset gọi ngay ở chỗ lưu phiên) -> profile cũ của B trong store bị xóa ngay
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-a2', refreshToken: 'rt-a2', user: USER_A }))
    await store.getState().auth.login({ identifier: 'meo', password: 'Password123!', rememberMe: true })
    expect(useProfileStore.getState().profile).toBeNull()
  })

  it('GlobalProfileMenu tự tải lại khi currentUser.id đổi từ A sang B', async () => {
    // Bắt đầu với user A
    saveSession(
      {
        accessToken: 'jwt-a',
        refreshToken: 'rt-a',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: USER_A.id,
          username: USER_A.username,
          email: USER_A.email,
          name: USER_A.name,
          systemRole: USER_A.role,
          avatarUrl: USER_A.avatarUrl,
        },
      },
      true,
    )
    useProfileStore.setState({ profile: null, loading: false, error: null })
    useWorkflowStore.setState((state) => ({
      auth: {
        ...state.auth,
        currentUser: {
          id: USER_A.id,
          username: USER_A.username,
          email: USER_A.email,
          name: USER_A.name,
          systemRole: USER_A.role,
          avatarUrl: USER_A.avatarUrl,
        },
        token: 'jwt-a',
        isAuthenticated: true,
      },
    }))

    render(createElement(GlobalProfileMenu, { showName: true, onLogout: () => {} }))

    await waitFor(() => {
      expect(screen.getByText('Mèo Con')).toBeTruthy()
    })

    // Chuyển phiên sang user B (kể cả khi chưa gọi reset thủ công, đổi currentUser.id phải tự tải lại)
    saveSession(
      {
        accessToken: 'jwt-b',
        refreshToken: 'rt-b',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: USER_B.id,
          username: USER_B.username,
          email: USER_B.email,
          name: USER_B.name,
          systemRole: USER_B.role,
          avatarUrl: USER_B.avatarUrl,
        },
      },
      true,
    )
    useWorkflowStore.setState((state) => ({
      auth: {
        ...state.auth,
        currentUser: {
          id: USER_B.id,
          username: USER_B.username,
          email: USER_B.email,
          name: USER_B.name,
          systemRole: USER_B.role,
          avatarUrl: USER_B.avatarUrl,
        },
        token: 'jwt-b',
        isAuthenticated: true,
      },
    }))

    await waitFor(() => {
      expect(screen.getByText('alex.kim')).toBeTruthy()
    })
  })
})
