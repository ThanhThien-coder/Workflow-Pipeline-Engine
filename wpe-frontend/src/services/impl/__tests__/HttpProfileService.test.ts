// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpProfileService, PROFILE_METHODS_STILL_MOCKED } from '../HttpProfileService'
import { MockProfileApi } from '../../mock/MockWorkflowService.profile'
import { ProfileError } from '../../../types/profile.types'
import { ApiError } from '../../http/ApiError'
import { AUTH_TOKEN_KEY, setUnauthorizedHandler } from '../../http/apiClient'

/** A5 — HttpProfileService gọi /api/v1/users/me/* (backend UserProfileController). */

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined || body === null) return new Response(null, { status })
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function errorBody(status: number, error: string) {
  return { timestamp: '2026-11-13T00:00:00Z', status, error, message: `backend: ${error}`, path: '/x' }
}

const BACKEND_PROFILE = {
  userId: '2',
  displayName: 'Sarah Chen',
  email: 'sarah.chen@pipeline.engine',
  title: 'Project Lead',
  bio: 'Hi',
  avatarUrl: '/uploads/avatars/2-abc.png',
  skills: ['React'],
  links: { github: 'https://github.com/sarah', linkedin: '', website: '' },
  privacy: { visibility: 'members', showEmail: false, showStats: true },
  projects: [],
  recentActivity: [],
}

const EMPTY_LINKS = { github: '', linkedin: '', website: '' }

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

describe('A5: HttpProfileService', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let handler: Handler

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    handler = () => jsonResponse(200, BACKEND_PROFILE)
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(String(url), init ?? {}))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]

  it('getMyProfile: GET /users/me/profile, avatarUrl tương đối đổi thành URL đầy đủ của backend', async () => {
    const profile = await new HttpProfileService().getMyProfile()

    const [url, init] = lastCall()
    expect(url).toBe('http://localhost:8080/api/v1/users/me/profile')
    expect(init.method).toBe('GET')
    expect(profile.userId).toBe('2')
    expect(profile.avatarUrl).toBe('http://localhost:8080/uploads/avatars/2-abc.png')
    expect(profile.links.github).toBe('https://github.com/sarah')
  })

  it('getMyProfile: avatarUrl null giữ null', async () => {
    handler = () => jsonResponse(200, { ...BACKEND_PROFILE, avatarUrl: null })
    expect((await new HttpProfileService().getMyProfile()).avatarUrl).toBeNull()
  })

  it('updateProfile: PUT /users/me/profile kèm body JSON đúng UpdateProfileCommand', async () => {
    const cmd = {
      displayName: 'Sarah C.',
      email: 'sarah.new@pipeline.engine',
      title: 'Lead',
      bio: 'Bio',
      skills: ['React', 'Java'],
      links: { github: '', linkedin: '', website: 'https://sarah.dev' },
    }
    await new HttpProfileService().updateProfile(cmd)

    const [url, init] = lastCall()
    expect(url).toBe('http://localhost:8080/api/v1/users/me/profile')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual(cmd)
  })

  it('updateProfile: 409 EMAIL_TAKEN -> ProfileError EMAIL_TAKEN', async () => {
    handler = () => jsonResponse(409, errorBody(409, 'EMAIL_TAKEN'))
    const err = await new HttpProfileService()
      .updateProfile({ displayName: 'A', email: 'a@b.co', title: '', bio: '', skills: [], links: EMPTY_LINKS })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProfileError)
    expect((err as ProfileError).code).toBe('EMAIL_TAKEN')
  })

  it('updateProfile: 400 VALIDATION_FAILED -> ProfileError VALIDATION', async () => {
    handler = () => jsonResponse(400, errorBody(400, 'VALIDATION_FAILED'))
    const err = await new HttpProfileService()
      .updateProfile({ displayName: '', email: 'x', title: '', bio: '', skills: [], links: EMPTY_LINKS })
      .catch((e: unknown) => e)
    expect((err as ProfileError).code).toBe('VALIDATION')
  })

  it('changePassword: POST /users/me/password, trả void', async () => {
    handler = () => jsonResponse(200, { success: true, message: 'Password updated successfully' })
    await expect(
      new HttpProfileService().changePassword({ currentPassword: 'OldPassword1', newPassword: 'NewPassword9' }),
    ).resolves.toBeUndefined()

    const [url, init] = lastCall()
    expect(url).toBe('http://localhost:8080/api/v1/users/me/password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: 'OldPassword1', newPassword: 'NewPassword9' })
  })

  it.each([
    ['WRONG_PASSWORD', 'INVALID_PASSWORD'],
    ['VALIDATION_FAILED', 'WEAK_PASSWORD'],
  ])('changePassword: 400 %s -> ProfileError %s', async (backendCode, profileCode) => {
    handler = () => jsonResponse(400, errorBody(400, backendCode))
    const err = await new HttpProfileService()
      .changePassword({ currentPassword: 'x', newPassword: 'y' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProfileError)
    expect((err as ProfileError).code).toBe(profileCode)
  })

  it('lỗi khác (500) giữ nguyên ApiError để màn hình hiện message', async () => {
    handler = () => jsonResponse(500, errorBody(500, 'INTERNAL_SERVER_ERROR'))
    const err = await new HttpProfileService().getMyProfile().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('uploadAvatar: POST multipart /users/me/avatar, field "file", không tự đặt Content-Type, kèm Bearer token', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'access-1')
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', { type: 'image/png' })

    const profile = await new HttpProfileService().uploadAvatar(file)

    const [url, init] = lastCall()
    expect(url).toBe('http://localhost:8080/api/v1/users/me/avatar')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer access-1')
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('content-type')
    expect(profile.avatarUrl).toBe('http://localhost:8080/uploads/avatars/2-abc.png')
  })

  it('uploadAvatar: file trên 2MB -> ProfileError FILE_TOO_LARGE, không gọi backend', async () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    const err = await new HttpProfileService().uploadAvatar(big).catch((e: unknown) => e)
    expect((err as ProfileError).code).toBe('FILE_TOO_LARGE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['UNSUPPORTED_MEDIA', 'UNSUPPORTED_TYPE'],
    ['FILE_TOO_LARGE', 'FILE_TOO_LARGE'],
  ])('uploadAvatar: 400 %s -> ProfileError %s', async (backendCode, profileCode) => {
    handler = () => jsonResponse(400, errorBody(400, backendCode))
    const file = new File(['not an image'], 'fake.png', { type: 'image/png' })
    const err = await new HttpProfileService().uploadAvatar(file).catch((e: unknown) => e)
    expect((err as ProfileError).code).toBe(profileCode)
  })

  it('uploadAvatar: 401 -> gọi qua apiClient (kích hoạt tự làm mới token) rồi gửi lại 1 lần bằng token mới', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    setUnauthorizedHandler(async () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
      return true
    })
    handler = (_url, init) => {
      const auth = (init.headers as Record<string, string> | undefined)?.['Authorization']
      if (auth === 'Bearer old-token') return jsonResponse(401, errorBody(401, 'TOKEN_EXPIRED'))
      return jsonResponse(200, BACKEND_PROFILE)
    }
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', { type: 'image/png' })

    const profile = await new HttpProfileService().uploadAvatar(file)

    const avatarCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/users/me/avatar'))
    expect(avatarCalls).toHaveLength(2)
    const retryHeaders = (avatarCalls[1][1] as RequestInit).headers as Record<string, string>
    expect(retryHeaders['Authorization']).toBe('Bearer new-token')
    expect(profile.userId).toBe('2')
  })

  it('uploadAvatar: 401 mà làm mới token thất bại -> ném ApiError 401', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    setUnauthorizedHandler(async () => false)
    handler = () => jsonResponse(401, errorBody(401, 'TOKEN_EXPIRED'))
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', { type: 'image/png' })

    const err = await new HttpProfileService().uploadAvatar(file).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })

  it('removeAvatar: DELETE /users/me/avatar', async () => {
    handler = () => jsonResponse(200, { ...BACKEND_PROFILE, avatarUrl: null })
    const profile = await new HttpProfileService().removeAvatar()
    const [url, init] = lastCall()
    expect(url).toBe('http://localhost:8080/api/v1/users/me/avatar')
    expect(init.method).toBe('DELETE')
    expect(profile.avatarUrl).toBeNull()
  })

  it('4 phương thức chưa có trong SSOT vẫn gọi mock, không gọi fetch', async () => {
    expect([...PROFILE_METHODS_STILL_MOCKED].sort()).toEqual([
      'deactivateAccount',
      'deleteAccount',
      'setProjectPublic',
      'updatePrivacy',
    ])
    const mock = new MockProfileApi()
    const spies = PROFILE_METHODS_STILL_MOCKED.map((m) => vi.spyOn(mock, m).mockResolvedValue(undefined as never))
    const service = new HttpProfileService(mock)

    await service.setProjectPublic('1', true)
    await service.updatePrivacy({ visibility: 'private', showEmail: false, showStats: false })
    await service.deactivateAccount()
    await service.deleteAccount({ confirmation: 'DELETE' })

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
