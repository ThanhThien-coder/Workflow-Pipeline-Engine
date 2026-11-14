import type { IProfileService } from '../contracts/IProfileService'
import type {
  ChangePasswordCommand,
  DeleteAccountCommand,
  ProfileDto,
  ProfilePrivacyDto,
  ProfileProjectDto,
  UpdateProfileCommand,
} from '../../types/profile.types'
import { ApiError } from '../http/ApiError'
import { getStoredUser, notLoggedInError } from './http/auth'

export const PROFILE_FEATURE_NOT_SUPPORTED_MESSAGE = 'Tính năng chưa hỗ trợ'

function notSupportedError(): ApiError {
  return new ApiError({
    status: 501,
    code: 'NOT_SUPPORTED',
    message: PROFILE_FEATURE_NOT_SUPPORTED_MESSAGE,
  })
}

export class HttpProfileService implements IProfileService {
  async getMyProfile(): Promise<ProfileDto> {
    const user = getStoredUser()
    if (!user) throw notLoggedInError()
    const role = user.systemRole ?? (user as { role?: string }).role ?? 'USER'
    const displayName = user.name?.trim() || user.username
    return {
      userId: String(user.id),
      displayName,
      email: user.email,
      title: role,
      bio: '',
      avatarUrl: user.avatarUrl ?? null,
      skills: [],
      links: { github: '', linkedin: '', website: '' },
      privacy: { visibility: 'members', showEmail: false, showStats: true },
      projects: [],
      recentActivity: [],
    }
  }

  async updateProfile(_cmd: UpdateProfileCommand): Promise<ProfileDto> {
    throw notSupportedError()
  }

  async uploadAvatar(_file: File): Promise<ProfileDto> {
    throw notSupportedError()
  }

  async removeAvatar(): Promise<ProfileDto> {
    throw notSupportedError()
  }

  async changePassword(_cmd: ChangePasswordCommand): Promise<void> {
    throw notSupportedError()
  }

  async setProjectPublic(_projectId: string, _isPublic: boolean): Promise<ProfileProjectDto> {
    throw notSupportedError()
  }

  async updatePrivacy(_cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto> {
    throw notSupportedError()
  }

  async deactivateAccount(): Promise<void> {
    throw notSupportedError()
  }

  async deleteAccount(_cmd: DeleteAccountCommand): Promise<void> {
    throw notSupportedError()
  }
}
