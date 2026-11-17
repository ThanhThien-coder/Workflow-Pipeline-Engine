import type { IProfileService } from '../contracts/IProfileService'
import {
  ProfileError,
  ProfileNotFoundError,
  type ChangePasswordCommand,
  type DeleteAccountCommand,
  type ProfileDto,
  type ProfilePrivacyDto,
  type ProfileProjectDto,
  type PublicProfileDto,
  type UpdateProfileCommand,
} from '../../types/profile.types'
import { apiRequest } from '../http/apiClient'
import { isApiError } from '../http/ApiError'
import {
  updateStoredUser,
  replaceSessionTokens,
  toAuthResponseDto,
  type BackendAuthResponse,
} from './http/auth'

export function formatAgo(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 60 * 1000) {
    return 'just now'
  }
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`
  }
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  if (diffHours < 24) {
    return `${diffHours} h ago`
  }
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface BackendProfileProject {
  projectId: string
  name: string
  phaseLabel: string
  role: string
  contribution: string
  isPublic: boolean
  stats: {
    tasksDone: number
    tasksTotal: number
    onTimePct: number
  }
}

interface BackendProfileActivity {
  id: string
  text: string
  occurredAt: string
}

interface BackendProfileResponse {
  userId: string
  displayName: string
  email: string
  title: string | null
  bio: string | null
  avatarUrl: string | null
  skills: string[]
  links: {
    github?: string | null
    linkedin?: string | null
    website?: string | null
  }
  privacy: {
    visibility: 'private' | 'members' | 'public'
    showEmail: boolean
    showStats: boolean
  }
  projects: BackendProfileProject[]
  recentActivity: BackendProfileActivity[]
}

interface BackendPublicProfileResponse {
  userId: string
  displayName: string
  title: string | null
  bio: string | null
  avatarUrl: string | null
  skills: string[]
  links: {
    github?: string | null
    linkedin?: string | null
    website?: string | null
  }
  email: string | null
  stats: { tasksDone: number; tasksTotal: number; onTimePct: number } | null
  projects: BackendProfileProject[]
  isSelf: boolean
}

function mapProfileResponse(res: BackendProfileResponse, now?: Date): ProfileDto {
  return {
    userId: String(res.userId),
    displayName: res.displayName,
    email: res.email,
    title: res.title ?? '',
    bio: res.bio ?? '',
    avatarUrl: res.avatarUrl ?? null,
    skills: res.skills ?? [],
    links: {
      github: res.links?.github ?? '',
      linkedin: res.links?.linkedin ?? '',
      website: res.links?.website ?? '',
    },
    privacy: {
      visibility: res.privacy?.visibility ?? 'members',
      showEmail: Boolean(res.privacy?.showEmail),
      showStats: Boolean(res.privacy?.showStats),
    },
    projects: (res.projects ?? []).map((p) => ({
      projectId: String(p.projectId),
      name: p.name,
      phaseLabel: p.phaseLabel,
      role: p.role,
      contribution: p.contribution,
      isPublic: Boolean(p.isPublic),
      stats: {
        tasksDone: p.stats?.tasksDone ?? 0,
        tasksTotal: p.stats?.tasksTotal ?? 0,
        onTimePct: p.stats?.onTimePct ?? 0,
      },
    })),
    recentActivity: (res.recentActivity ?? []).map((a) => ({
      id: a.id,
      text: a.text,
      ago: formatAgo(a.occurredAt, now),
    })),
  }
}

export function mapProfileError(err: unknown): unknown {
  if (isApiError(err)) {
    switch (err.code) {
      case 'VALIDATION_FAILED':
        return new ProfileError('VALIDATION')
      case 'INVALID_LINK':
        return new ProfileError('INVALID_LINK')
      case 'WRONG_PASSWORD':
        return new ProfileError('INVALID_PASSWORD')
      case 'WEAK_PASSWORD':
        return new ProfileError('WEAK_PASSWORD')
      case 'UNSUPPORTED_MEDIA':
        return new ProfileError('UNSUPPORTED_TYPE')
      case 'FILE_TOO_LARGE':
        return new ProfileError('FILE_TOO_LARGE')
      case 'CONFIRMATION_MISMATCH':
        return new ProfileError('CONFIRMATION_MISMATCH')
      case 'SAME_PASSWORD':
        return new Error('Your new password must be different from the current one.')
      case 'EMAIL_TAKEN':
        return new Error('This email is already used by another account.')
      case 'OWNS_PROJECTS':
        return new Error('Transfer or delete the projects you own before deleting your account.')
      case 'ADMIN_SELF_SERVICE':
        return new Error('Administrator accounts cannot be deactivated or deleted here.')
      default:
        return err
    }
  }
  return err
}

export class HttpProfileService implements IProfileService {
  async getMyProfile(): Promise<ProfileDto> {
    try {
      const res = await apiRequest<BackendProfileResponse>('GET', '/users/me/profile')
      const dto = mapProfileResponse(res)
      updateStoredUser({
        name: dto.displayName,
        email: dto.email,
        avatarUrl: dto.avatarUrl,
      })
      return dto
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDto> {
    try {
      const res = await apiRequest<BackendProfileResponse>('PUT', '/users/me/profile', {
        body: {
          displayName: cmd.displayName,
          email: cmd.email,
          title: cmd.title,
          bio: cmd.bio,
          skills: cmd.skills,
          links: cmd.links,
        },
      })
      const dto = mapProfileResponse(res)
      updateStoredUser({
        name: dto.displayName,
        email: dto.email,
        avatarUrl: dto.avatarUrl,
      })
      return dto
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async uploadAvatar(file: File): Promise<ProfileDto> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new ProfileError('UNSUPPORTED_TYPE')
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new ProfileError('FILE_TOO_LARGE')
    }
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiRequest<BackendProfileResponse>('POST', '/users/me/avatar', {
        body: formData,
      })
      const dto = mapProfileResponse(res)
      updateStoredUser({ avatarUrl: dto.avatarUrl })
      return dto
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async removeAvatar(): Promise<ProfileDto> {
    try {
      const res = await apiRequest<BackendProfileResponse>('DELETE', '/users/me/avatar')
      const dto = mapProfileResponse(res)
      updateStoredUser({ avatarUrl: null })
      return dto
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async changePassword(cmd: ChangePasswordCommand): Promise<void> {
    try {
      const data = await apiRequest<BackendAuthResponse>('POST', '/users/me/password', {
        body: {
          currentPassword: cmd.currentPassword,
          newPassword: cmd.newPassword,
        },
      })
      replaceSessionTokens(toAuthResponseDto(data))
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async setProjectPublic(projectId: string, isPublic: boolean): Promise<ProfileProjectDto> {
    try {
      const p = await apiRequest<BackendProfileProject>('PATCH', `/users/me/projects/${projectId}`, {
        body: { isPublic },
      })
      return {
        projectId: String(p.projectId),
        name: p.name,
        phaseLabel: p.phaseLabel,
        role: p.role,
        contribution: p.contribution,
        isPublic: Boolean(p.isPublic),
        stats: {
          tasksDone: p.stats?.tasksDone ?? 0,
          tasksTotal: p.stats?.tasksTotal ?? 0,
          onTimePct: p.stats?.onTimePct ?? 0,
        },
      }
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async updatePrivacy(cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto> {
    try {
      const res = await apiRequest<ProfilePrivacyDto>('PUT', '/users/me/privacy', {
        body: {
          visibility: cmd.visibility,
          showEmail: cmd.showEmail,
          showStats: cmd.showStats,
        },
      })
      return {
        visibility: res.visibility,
        showEmail: res.showEmail,
        showStats: res.showStats,
      }
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async deactivateAccount(): Promise<void> {
    try {
      await apiRequest<void>('POST', '/users/me/deactivate')
    } catch (err) {
      throw mapProfileError(err)
    }
  }

  async getUserProfile(userId: string): Promise<PublicProfileDto> {
    try {
      const res = await apiRequest<BackendPublicProfileResponse>(
        'GET',
        `/users/${encodeURIComponent(userId)}/profile`,
      )
      return {
        userId: String(res.userId),
        displayName: res.displayName,
        title: res.title ?? '',
        bio: res.bio ?? '',
        avatarUrl: res.avatarUrl ?? null,
        skills: res.skills ?? [],
        links: {
          github: res.links?.github ?? '',
          linkedin: res.links?.linkedin ?? '',
          website: res.links?.website ?? '',
        },
        email: res.email ?? null,
        stats: res.stats
          ? {
              tasksDone: res.stats.tasksDone ?? 0,
              tasksTotal: res.stats.tasksTotal ?? 0,
              onTimePct: res.stats.onTimePct ?? 0,
            }
          : null,
        projects: (res.projects ?? []).map((p) => ({
          projectId: String(p.projectId),
          name: p.name,
          phaseLabel: p.phaseLabel,
          role: p.role,
          contribution: p.contribution,
          isPublic: Boolean(p.isPublic),
          stats: {
            tasksDone: p.stats?.tasksDone ?? 0,
            tasksTotal: p.stats?.tasksTotal ?? 0,
            onTimePct: p.stats?.onTimePct ?? 0,
          },
        })),
        isSelf: Boolean(res.isSelf),
      }
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        throw new ProfileNotFoundError()
      }
      throw mapProfileError(err)
    }
  }

  async deleteAccount(cmd: DeleteAccountCommand): Promise<void> {
    if (cmd.confirmation !== 'DELETE') {
      throw new ProfileError('CONFIRMATION_MISMATCH')
    }
    try {
      await apiRequest<void>('DELETE', '/users/me', {
        body: { confirmation: cmd.confirmation },
      })
    } catch (err) {
      throw mapProfileError(err)
    }
  }
}
