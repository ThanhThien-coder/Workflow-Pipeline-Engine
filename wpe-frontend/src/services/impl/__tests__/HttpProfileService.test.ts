// @vitest-environment jsdom
import { createElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpProfileService, formatAgo, mapProfileError } from '../HttpProfileService'
import { HttpWorkflowService } from '../HttpWorkflowService'
import { saveSession, REFRESH_TOKEN_KEY } from '../http/auth'
import { ApiError } from '../../http/ApiError'
import { ProfileError } from '../../../types/profile.types'
import { createWorkflowStore, useWorkflowStore } from '../../../store/useWorkflowStore'
import { useProfileStore } from '../../../store/useProfileStore'
import { GlobalProfileMenu } from '../../../components/common/GlobalProfileMenu'
import { getSavedAvatar } from '../../../utils/avatarUtils'

vi.mock('../../../services/env', () => ({
  isMockMode: false,
}))

vi.mock('../../container', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../container')>()
  const { HttpWorkflowService: HttpWf } = await import('../HttpWorkflowService')
  const { HttpProfileService: HttpProfile } = await import('../HttpProfileService')
  const workflowService = new HttpWf()
  const profileService = new HttpProfile()
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

function jsonResponse(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  if (status === 204 || body === undefined || body === null) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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

describe('formatAgo: định dạng mốc thời gian hoạt động', () => {
  const now = new Date('2026-11-17T10:00:00.000Z')

  it('< 1 phút: trả "just now"', () => {
    expect(formatAgo(now, now)).toBe('just now')
    expect(formatAgo(new Date('2026-11-17T09:59:30.000Z'), now)).toBe('just now')
    expect(formatAgo(new Date('2026-11-17T09:59:01.000Z'), now)).toBe('just now')
  })

  it('< 60 phút: trả "{n} min ago"', () => {
    expect(formatAgo(new Date('2026-11-17T09:59:00.000Z'), now)).toBe('1 min ago')
    expect(formatAgo(new Date('2026-11-17T09:45:00.000Z'), now)).toBe('15 min ago')
    expect(formatAgo(new Date('2026-11-17T09:01:00.000Z'), now)).toBe('59 min ago')
  })

  it('< 24 giờ: trả "{n} h ago"', () => {
    expect(formatAgo(new Date('2026-11-17T09:00:00.000Z'), now)).toBe('1 h ago')
    expect(formatAgo(new Date('2026-11-17T05:00:00.000Z'), now)).toBe('5 h ago')
    expect(formatAgo(new Date('2026-11-16T11:00:00.000Z'), now)).toBe('23 h ago')
  })

  it('< 7 ngày: trả "1 day ago" hoặc "{n} days ago"', () => {
    expect(formatAgo(new Date('2026-11-16T10:00:00.000Z'), now)).toBe('1 day ago')
    expect(formatAgo(new Date('2026-11-15T10:00:00.000Z'), now)).toBe('2 days ago')
    expect(formatAgo(new Date('2026-11-11T10:00:00.000Z'), now)).toBe('6 days ago')
  })

  it('>= 7 ngày: trả ngày dạng "Nov 3, 2026"', () => {
    expect(formatAgo(new Date('2026-11-10T10:00:00.000Z'), now)).toBe('Nov 10, 2026')
    expect(formatAgo(new Date('2026-11-03T10:00:00.000Z'), now)).toBe('Nov 3, 2026')
    expect(formatAgo(new Date('2025-01-15T00:00:00.000Z'), now)).toBe('Jan 15, 2025')
  })
})

describe('HttpProfileService: 9 chức năng API thật', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let service: HttpProfileService

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    service = new HttpProfileService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('1. getMyProfile: GET /users/me/profile, ánh xạ activity.ago và updateStoredUser', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '1', username: 'alex.kim', email: 'old@wpe.io', name: 'Old Name' }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: '1',
        displayName: 'Alex Kim',
        email: 'alex.kim@pipeline.engine',
        title: 'Tech Lead',
        bio: 'Hello world',
        avatarUrl: '/uploads/avatars/alex.png',
        skills: ['Java', 'React'],
        links: { github: 'https://github.com/alexkim', linkedin: '', website: '' },
        privacy: { visibility: 'public', showEmail: true, showStats: true },
        projects: [
          {
            projectId: '10',
            name: 'Project Alpha',
            phaseLabel: 'Phase 1 · Active',
            role: 'Owner',
            contribution: 'Completed 2 of 5 tasks',
            isPublic: true,
            stats: { tasksDone: 2, tasksTotal: 5, onTimePct: 80 },
          },
        ],
        recentActivity: [
          { id: 'act-1', text: 'Completed node 1', occurredAt: new Date(Date.now() - 30_000).toISOString() },
        ],
      }),
    )

    const profile = await service.getMyProfile()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/profile')
    expect(init?.method).toBe('GET')

    expect(profile.userId).toBe('1')
    expect(profile.displayName).toBe('Alex Kim')
    expect(profile.email).toBe('alex.kim@pipeline.engine')
    expect(profile.avatarUrl).toBe('/uploads/avatars/alex.png')
    expect(profile.projects).toHaveLength(1)
    expect(profile.projects[0].projectId).toBe('10')
    expect(profile.projects[0].isPublic).toBe(true)
    expect(profile.recentActivity).toHaveLength(1)
    expect(profile.recentActivity[0].ago).toBe('just now')

    const storedUser = JSON.parse(localStorage.getItem('wpe_auth_user')!)
    expect(storedUser.name).toBe('Alex Kim')
    expect(storedUser.email).toBe('alex.kim@pipeline.engine')
    expect(storedUser.avatarUrl).toBe('/uploads/avatars/alex.png')
  })

  it('2. updateProfile: PUT /users/me/profile với body chuẩn và updateStoredUser', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '1', username: 'alex.kim', email: 'old@wpe.io', name: 'Old' }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: '1',
        displayName: 'Alex Kim Updated',
        email: 'alex.updated@pipeline.engine',
        title: 'Architect',
        bio: 'Updated bio',
        avatarUrl: '/uploads/avatars/alex.png',
        skills: ['Rust'],
        links: { github: 'https://github.com/alex', linkedin: '', website: '' },
        privacy: { visibility: 'members', showEmail: false, showStats: true },
        projects: [],
        recentActivity: [],
      }),
    )

    const cmd = {
      displayName: 'Alex Kim Updated',
      email: 'alex.updated@pipeline.engine',
      title: 'Architect',
      bio: 'Updated bio',
      skills: ['Rust'],
      links: { github: 'https://github.com/alex', linkedin: '', website: '' },
    }

    const updated = await service.updateProfile(cmd)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/profile')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual(cmd)

    expect(updated.displayName).toBe('Alex Kim Updated')
    const storedUser = JSON.parse(localStorage.getItem('wpe_auth_user')!)
    expect(storedUser.name).toBe('Alex Kim Updated')
    expect(storedUser.email).toBe('alex.updated@pipeline.engine')
  })

  it('3. uploadAvatar: gửi multipart/form-data với part "file", không có Content-Type JSON, updateStoredUser', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    localStorage.setItem('wpe_auth_user', JSON.stringify({ id: '1', username: 'alex', avatarUrl: null }))

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: '1',
        displayName: 'Alex',
        email: 'alex@wpe.io',
        avatarUrl: '/uploads/avatars/1-abcdef0123456789.png',
        skills: [],
        links: { github: '', linkedin: '', website: '' },
        privacy: { visibility: 'members', showEmail: false, showStats: true },
        projects: [],
        recentActivity: [],
      }),
    )

    const file = new File(['png-data'], 'avatar.png', { type: 'image/png' })
    const res = await service.uploadAvatar(file)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/avatar')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBe(file)
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()

    expect(res.avatarUrl).toBe('/uploads/avatars/1-abcdef0123456789.png')
    const stored = JSON.parse(localStorage.getItem('wpe_auth_user')!)
    expect(stored.avatarUrl).toBe('/uploads/avatars/1-abcdef0123456789.png')
  })

  it('3b. uploadAvatar: kiểm trước ở máy sai MIME type hoặc quá 2MB thì ném lỗi và KHÔNG gọi mạng', async () => {
    const badMime = new File(['gif'], 'avatar.gif', { type: 'image/gif' })
    await expect(service.uploadAvatar(badMime)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ProfileError)
      expect((err as ProfileError).code).toBe('UNSUPPORTED_TYPE')
      return true
    })
    expect(fetchMock).not.toHaveBeenCalled()

    const hugeFile = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await expect(service.uploadAvatar(hugeFile)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ProfileError)
      expect((err as ProfileError).code).toBe('FILE_TOO_LARGE')
      return true
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('4. removeAvatar: DELETE /users/me/avatar và updateStoredUser({ avatarUrl: null })', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '1', username: 'alex', avatarUrl: '/uploads/avatars/old.png' }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: '1',
        displayName: 'Alex',
        email: 'alex@wpe.io',
        avatarUrl: null,
        skills: [],
        links: { github: '', linkedin: '', website: '' },
        privacy: { visibility: 'members', showEmail: false, showStats: true },
        projects: [],
        recentActivity: [],
      }),
    )

    const res = await service.removeAvatar()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/avatar')
    expect(init?.method).toBe('DELETE')

    expect(res.avatarUrl).toBeNull()
    const stored = JSON.parse(localStorage.getItem('wpe_auth_user')!)
    expect(stored.avatarUrl).toBeNull()
  })

  it('5. changePassword: POST /users/me/password, lưu token mới vào storage phiên hiện tại', async () => {
    localStorage.setItem('wpe_auth_token', 'old-token')
    localStorage.setItem(REFRESH_TOKEN_KEY, 'old-refresh')
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '1', username: 'alex', email: 'alex@wpe.io', systemRole: 'ADMIN' }),
    )

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        token: 'example-new-access-token',
        refreshToken: 'example-new-refresh-token',
        user: {
          id: '1',
          username: 'alex',
          email: 'alex@wpe.io',
          name: 'Alex Kim',
          role: 'ADMIN',
          avatarUrl: '/uploads/avatars/alex.png',
        },
      }),
    )

    await service.changePassword({ currentPassword: 'example-current-pass-1', newPassword: 'example-new-pass-2' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/password')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      currentPassword: 'example-current-pass-1',
      newPassword: 'example-new-pass-2',
    })

    expect(localStorage.getItem('wpe_auth_token')).toBe('example-new-access-token')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('example-new-refresh-token')
    const user = JSON.parse(localStorage.getItem('wpe_auth_user')!)
    expect(user.avatarUrl).toBe('/uploads/avatars/alex.png')
  })

  it('6. setProjectPublic: PATCH /users/me/projects/{projectId} với { isPublic }', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        projectId: '42',
        name: 'Workflow Core',
        phaseLabel: 'Phase 2',
        role: 'Manager',
        contribution: 'Lead engineer',
        isPublic: true,
        stats: { tasksDone: 10, tasksTotal: 12, onTimePct: 90 },
      }),
    )

    const res = await service.setProjectPublic('42', true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/projects/42')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ isPublic: true })

    expect(res.projectId).toBe('42')
    expect(res.isPublic).toBe(true)
    expect(res.stats.tasksDone).toBe(10)
  })

  it('7. updatePrivacy: PUT /users/me/privacy', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        visibility: 'private',
        showEmail: false,
        showStats: false,
      }),
    )

    const res = await service.updatePrivacy({ visibility: 'private', showEmail: false, showStats: false })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/privacy')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toEqual({
      visibility: 'private',
      showEmail: false,
      showStats: false,
    })

    expect(res.visibility).toBe('private')
    expect(res.showEmail).toBe(false)
  })

  it('8. deactivateAccount: POST /users/me/deactivate', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    fetchMock.mockResolvedValueOnce(jsonResponse(204))

    await service.deactivateAccount()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me/deactivate')
    expect(init?.method).toBe('POST')
  })

  it('9. deleteAccount: DELETE /users/me với { confirmation: "DELETE" }', async () => {
    localStorage.setItem('wpe_auth_token', 'token-123')
    fetchMock.mockResolvedValueOnce(jsonResponse(204))

    await service.deleteAccount({ confirmation: 'DELETE' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/v1/users/me')
    expect(init?.method).toBe('DELETE')
    expect(JSON.parse(String(init?.body))).toEqual({ confirmation: 'DELETE' })
  })

  it('9b. deleteAccount: sai chữ confirmation thì ném ProfileError và KHÔNG gọi mạng', async () => {
    await expect(service.deleteAccount({ confirmation: 'delete' })).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ProfileError)
      expect((err as ProfileError).code).toBe('CONFIRMATION_MISMATCH')
      return true
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(service.deleteAccount({ confirmation: 'CANCEL' })).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ProfileError)
      expect((err as ProfileError).code).toBe('CONFIRMATION_MISMATCH')
      return true
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('mapProfileError: bảng đổi mã lỗi API sang lỗi trang Profile', () => {
  it('đổi đúng các mã lỗi ProfileError', () => {
    const errPairs: [string, string][] = [
      ['VALIDATION_FAILED', 'VALIDATION'],
      ['INVALID_LINK', 'INVALID_LINK'],
      ['WRONG_PASSWORD', 'INVALID_PASSWORD'],
      ['WEAK_PASSWORD', 'WEAK_PASSWORD'],
      ['UNSUPPORTED_MEDIA', 'UNSUPPORTED_TYPE'],
      ['FILE_TOO_LARGE', 'FILE_TOO_LARGE'],
      ['CONFIRMATION_MISMATCH', 'CONFIRMATION_MISMATCH'],
    ]

    for (const [code, expectedProfileCode] of errPairs) {
      const apiErr = new ApiError({ status: 400, code, message: 'Backend error' })
      const mapped = mapProfileError(apiErr)
      expect(mapped).toBeInstanceOf(ProfileError)
      expect((mapped as ProfileError).code).toBe(expectedProfileCode)
    }
  })

  it('đổi đúng các mã lỗi nghiệp vụ sang Error thông báo rõ ràng', () => {
    const samePw = mapProfileError(new ApiError({ status: 400, code: 'SAME_PASSWORD', message: 'x' }))
    expect((samePw as Error).message).toBe('Your new password must be different from the current one.')

    const emailTaken = mapProfileError(new ApiError({ status: 409, code: 'EMAIL_TAKEN', message: 'x' }))
    expect((emailTaken as Error).message).toBe('This email is already used by another account.')

    const ownsProj = mapProfileError(new ApiError({ status: 409, code: 'OWNS_PROJECTS', message: 'x' }))
    expect((ownsProj as Error).message).toBe('Transfer or delete the projects you own before deleting your account.')

    const adminSelf = mapProfileError(new ApiError({ status: 403, code: 'ADMIN_SELF_SERVICE', message: 'x' }))
    expect((adminSelf as Error).message).toBe('Administrator accounts cannot be deactivated or deleted here.')
  })

  it('mã lỗi khác giữ nguyên ApiError', () => {
    const genericErr = new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Server boom' })
    expect(mapProfileError(genericErr)).toBe(genericErr)
  })
})

describe('avatarUtils: ở chế độ thật (!isMockMode)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('không đọc wpe_mock_profile_v2 và không dùng luật cứng ("sarah chen", "2", "sc")', () => {
    localStorage.setItem(
      'wpe_mock_profile_v2',
      JSON.stringify({ displayName: 'Sarah Chen', userId: '2', avatarUrl: 'https://example.com/mock.png' }),
    )

    expect(getSavedAvatar()).toBeNull()
    expect(getSavedAvatar('sarah chen')).toBeNull()
    expect(getSavedAvatar('2')).toBeNull()
    expect(getSavedAvatar('sc')).toBeNull()
  })

  it('chỉ trả avatarUrl của wpe_auth_user khi nameOrId rỗng hoặc trùng id/username/name (không phân biệt hoa thường)', () => {
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({
        id: '101',
        username: 'thanhthien',
        name: 'Thanh Thien',
        avatarUrl: '/uploads/avatars/thien.png',
      }),
    )

    expect(getSavedAvatar()).toBe('/uploads/avatars/thien.png')
    expect(getSavedAvatar('101')).toBe('/uploads/avatars/thien.png')
    expect(getSavedAvatar('thanhthien')).toBe('/uploads/avatars/thien.png')
    expect(getSavedAvatar('THANHTHIEN')).toBe('/uploads/avatars/thien.png')
    expect(getSavedAvatar('Thanh Thien')).toBe('/uploads/avatars/thien.png')
    expect(getSavedAvatar('thanh thien')).toBe('/uploads/avatars/thien.png')

    // Tên khác hoặc không khớp -> null
    expect(getSavedAvatar('other_user')).toBeNull()
    expect(getSavedAvatar('sarah chen')).toBeNull()
    expect(getSavedAvatar('2')).toBeNull()
  })

  it('đọc từ sessionStorage nếu phiên nằm ở sessionStorage', () => {
    sessionStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({
        id: '55',
        username: 'session.user',
        name: 'Session User',
        avatarUrl: '/uploads/avatars/session.png',
      }),
    )

    expect(getSavedAvatar()).toBe('/uploads/avatars/session.png')
    expect(getSavedAvatar('session.user')).toBe('/uploads/avatars/session.png')
  })

  it('user không có avatarUrl -> trả null', () => {
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({ id: '1', username: 'alex', avatarUrl: null }),
    )

    expect(getSavedAvatar()).toBeNull()
    expect(getSavedAvatar('alex')).toBeNull()
  })
})

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
    const service = new HttpProfileService()

    // 1. Chưa đăng nhập: fetch trả 401
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: 401, error: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' }),
    )
    await expect(service.getMyProfile()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })

    // 2. Đăng nhập User A
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

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: USER_A.id,
        displayName: USER_A.name,
        email: USER_A.email,
        title: USER_A.role,
        bio: '',
        avatarUrl: USER_A.avatarUrl,
        skills: [],
        links: { github: '', linkedin: '', website: '' },
        privacy: { visibility: 'members', showEmail: false, showStats: true },
        projects: [],
        recentActivity: [],
      }),
    )

    const profileA = await service.getMyProfile()
    expect(profileA.userId).toBe('101')
    expect(profileA.displayName).toBe('Mèo Con')
    expect(profileA.email).toBe('meo@pipeline.engine')
    expect(profileA.avatarUrl).toBe('https://example.com/meo.png')

    // 3. Đăng nhập User B
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

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        userId: USER_B.id,
        displayName: USER_B.username,
        email: USER_B.email,
        title: USER_B.role,
        bio: '',
        avatarUrl: USER_B.avatarUrl,
        skills: [],
        links: { github: '', linkedin: '', website: '' },
        privacy: { visibility: 'members', showEmail: false, showStats: true },
        projects: [],
        recentActivity: [],
      }),
    )

    const profileB = await service.getMyProfile()
    expect(profileB.userId).toBe('202')
    expect(profileB.displayName).toBe('alex.kim')
    expect(profileB.email).toBe('alex.kim@pipeline.engine')
    expect(profileB.avatarUrl).toBeNull()
  })

  it('Đăng nhập A → profile A; đăng xuất, đăng nhập B (hoặc đăng nhập đè B) → profile B (không còn A)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const urlStr = String(url)
      if (urlStr.includes('/auth/login')) {
        return jsonResponse(200, {
          token: urlStr.includes('meo') ? 'jwt-a' : 'jwt-b',
          refreshToken: 'rt-mock',
          user: urlStr.includes('meo') ? USER_A : USER_B,
        })
      }
      if (urlStr.includes('/users/me/profile')) {
        const token = localStorage.getItem('wpe_auth_token') ?? sessionStorage.getItem('wpe_auth_token')
        const user = token === 'jwt-a' || token === 'jwt-a2' ? USER_A : USER_B
        return jsonResponse(200, {
          userId: user.id,
          displayName: user.name || user.username,
          email: user.email,
          title: user.role,
          bio: '',
          avatarUrl: user.avatarUrl,
          skills: [],
          links: { github: '', linkedin: '', website: '' },
          privacy: { visibility: 'members', showEmail: false, showStats: true },
          projects: [],
          recentActivity: [],
        })
      }
      return jsonResponse(200, { success: true })
    })

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
    fetchMock.mockImplementation(async (url: string) => {
      const urlStr = String(url)
      if (urlStr.includes('/users/me/profile')) {
        const token = localStorage.getItem('wpe_auth_token') ?? sessionStorage.getItem('wpe_auth_token')
        const user = token === 'jwt-a' ? USER_A : USER_B
        return jsonResponse(200, {
          userId: user.id,
          displayName: user.name || user.username,
          email: user.email,
          title: user.role,
          bio: '',
          avatarUrl: user.avatarUrl,
          skills: [],
          links: { github: '', linkedin: '', website: '' },
          privacy: { visibility: 'members', showEmail: false, showStats: true },
          projects: [],
          recentActivity: [],
        })
      }
      return jsonResponse(200, {})
    })

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
