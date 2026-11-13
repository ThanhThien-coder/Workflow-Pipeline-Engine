import type { IProfileService } from '../contracts/IProfileService'
import {
  ProfileError,
  type ChangePasswordCommand,
  type DeleteAccountCommand,
  type ProfileDto,
  type ProfileErrorCode,
  type ProfilePrivacyDto,
  type ProfileProjectDto,
  type UpdateProfileCommand,
} from '../../types/profile.types'
import { MockProfileApi } from '../mock/MockWorkflowService.profile'
import { API_BASE_URL, apiRequest, buildUrl, getStoredToken } from '../http/apiClient'
import { ApiError, NETWORK_ERROR_CODE, isApiError } from '../http/ApiError'

/**
 * A5 — HttpProfileService: hồ sơ cá nhân qua /api/v1/users/me/* (backend UserProfileController).
 *
 * Phương thức gọi API backend thật:
 * - getMyProfile:   GET    /users/me/profile
 * - updateProfile:  PUT    /users/me/profile
 * - changePassword: POST   /users/me/password
 * - uploadAvatar:   POST   /users/me/avatar   (multipart, field "file")
 * - removeAvatar:   DELETE /users/me/avatar
 *
 * Các phương thức CHƯA CÓ trong SSOT nên vẫn gọi MockProfileApi (còn mock):
 * - setProjectPublic
 * - updatePrivacy
 * - deactivateAccount
 * - deleteAccount
 *
 * Backend chưa có dữ liệu privacy / projects / recentActivity: trả mặc định
 * (privacy {members, false, true}, projects [], recentActivity []).
 *
 * Lỗi: mã nghiệp vụ của backend đổi thành ProfileError (ProfileView có câu báo riêng);
 * lỗi khác (mạng, 401, 500) giữ nguyên ApiError.
 */
export const PROFILE_METHODS_STILL_MOCKED = [
  'setProjectPublic',
  'updatePrivacy',
  'deactivateAccount',
  'deleteAccount',
] as const

/** Đặc tả A5: ảnh tối đa 2MB. Kiểm sớm ở FE để khỏi tải file lớn lên rồi mới bị từ chối. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

type ErrorContext = 'profile' | 'password' | 'avatar'

/** Mã lỗi backend -> mã ProfileError. VALIDATION_FAILED khác nghĩa theo màn: đổi mật khẩu là mật khẩu yếu. */
function toProfileErrorCode(code: string, context: ErrorContext): ProfileErrorCode | null {
  switch (code) {
    case 'EMAIL_TAKEN':
      return 'EMAIL_TAKEN'
    case 'WRONG_PASSWORD':
      return 'INVALID_PASSWORD'
    case 'UNSUPPORTED_MEDIA':
      return 'UNSUPPORTED_TYPE'
    case 'FILE_TOO_LARGE':
      return 'FILE_TOO_LARGE'
    case 'VALIDATION_FAILED':
      return context === 'password' ? 'WEAK_PASSWORD' : 'VALIDATION'
    default:
      return null
  }
}

function mapError(error: unknown, context: ErrorContext): unknown {
  if (!isApiError(error)) return error
  const code = toProfileErrorCode(error.code, context)
  return code ? new ProfileError(code) : error
}

/** Gốc của backend (http://localhost:8080) để ghép với avatarUrl tương đối /uploads/avatars/... */
function backendOrigin(): string | null {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return null // API_BASE_URL tương đối (chạy qua proxy): giữ URL tương đối
  }
}

function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const origin = backendOrigin()
  return origin && url.startsWith('/') ? origin + url : url
}

function normalize(dto: ProfileDto): ProfileDto {
  return { ...dto, avatarUrl: resolveAvatarUrl(dto.avatarUrl) }
}

async function readApiError(res: Response): Promise<ApiError> {
  let data: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(await res.text())
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
  } catch {
    // body không phải JSON
  }
  return new ApiError({
    status: res.status,
    code: typeof data.error === 'string' && data.error ? data.error : `HTTP_${res.status}`,
    message: typeof data.message === 'string' && data.message ? data.message : `Yêu cầu thất bại (HTTP ${res.status})`,
  })
}

/**
 * apiClient chỉ gửi body JSON, nên upload multipart tự gọi fetch. Không đặt Content-Type để trình duyệt
 * tự thêm boundary. Token lấy giống apiClient.
 */
async function postAvatar(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getStoredToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    return await fetch(buildUrl('/users/me/avatar'), { method: 'POST', headers, body: form })
  } catch {
    throw new ApiError({
      status: 0,
      code: NETWORK_ERROR_CODE,
      message: 'Không kết nối được tới máy chủ. Vui lòng kiểm tra backend hoặc mạng.',
    })
  }
}

export class HttpProfileService implements IProfileService {
  private readonly mock: MockProfileApi

  constructor(mock?: MockProfileApi) {
    this.mock = mock ?? new MockProfileApi()
  }

  // ───────────────────────── API thật (A5) ─────────────────────────

  async getMyProfile(): Promise<ProfileDto> {
    try {
      return normalize(await apiRequest<ProfileDto>('GET', '/users/me/profile'))
    } catch (error) {
      throw mapError(error, 'profile')
    }
  }

  async updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDto> {
    try {
      return normalize(await apiRequest<ProfileDto>('PUT', '/users/me/profile', { body: cmd }))
    } catch (error) {
      throw mapError(error, 'profile')
    }
  }

  async changePassword(cmd: ChangePasswordCommand): Promise<void> {
    try {
      await apiRequest<unknown>('POST', '/users/me/password', {
        body: { currentPassword: cmd.currentPassword, newPassword: cmd.newPassword },
      })
    } catch (error) {
      throw mapError(error, 'password')
    }
  }

  async uploadAvatar(file: File): Promise<ProfileDto> {
    if (file.size > MAX_AVATAR_BYTES) throw new ProfileError('FILE_TOO_LARGE')

    let res = await postAvatar(file)
    if (res.status === 401 && getStoredToken()) {
      // Access token hết hạn: gọi 1 request JSON qua apiClient để kích hoạt tự làm mới token (A4),
      // thành công thì gửi lại ảnh đúng 1 lần bằng token mới. Thất bại thì ném lỗi của apiClient.
      try {
        await apiRequest<ProfileDto>('GET', '/users/me/profile')
      } catch (error) {
        throw mapError(error, 'avatar')
      }
      res = await postAvatar(file)
    }
    if (!res.ok) throw mapError(await readApiError(res), 'avatar')
    return normalize((await res.json()) as ProfileDto)
  }

  async removeAvatar(): Promise<ProfileDto> {
    try {
      return normalize(await apiRequest<ProfileDto>('DELETE', '/users/me/avatar'))
    } catch (error) {
      throw mapError(error, 'avatar')
    }
  }

  // ───────────────────────── Còn mock (chưa có trong SSOT) ─────────────────────────

  setProjectPublic(projectId: string, isPublic: boolean): Promise<ProfileProjectDto> {
    return this.mock.setProjectPublic(projectId, isPublic)
  }

  updatePrivacy(cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto> {
    return this.mock.updatePrivacy(cmd)
  }

  deactivateAccount(): Promise<void> {
    return this.mock.deactivateAccount()
  }

  deleteAccount(cmd: DeleteAccountCommand): Promise<void> {
    return this.mock.deleteAccount(cmd)
  }
}
