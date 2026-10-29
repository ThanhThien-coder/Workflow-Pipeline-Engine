import type { IProfileService } from '../contracts/IProfileService'
import type { ChangePasswordCommand, DeleteAccountCommand, ProfileDto, ProfilePrivacyDto, ProfileProjectDto, UpdateProfileCommand } from '../../types/profile.types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window === 'undefined' ? null : (localStorage.getItem('wpe_auth_token') || sessionStorage.getItem('wpe_auth_token'))
  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: headers(init.headers as Record<string, string> | undefined) })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message || `Profile API failed (HTTP ${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function mapProfile(data: any): ProfileDto {
  return {
    ...data,
    userId: String(data.userId),
    avatarUrl: data.avatarUrl ?? null,
    skills: data.skills ?? [],
    links: { github: data.links?.github ?? '', linkedin: data.links?.linkedin ?? '', website: data.links?.website ?? '' },
    privacy: data.privacy ? { ...data.privacy, visibility: String(data.privacy.visibility).toLowerCase() } : { visibility: 'private', showEmail: false, showStats: false },
    projects: (data.projects ?? []).map((p: any) => ({ ...p, projectId: String(p.projectId) })),
    recentActivity: data.recentActivity ?? [],
    title: data.title ?? '', bio: data.bio ?? '',
  }
}

export class HttpProfileService implements IProfileService {
  async getMyProfile(): Promise<ProfileDto> { return mapProfile(await request('/users/me/profile')) }

  async updateProfile(cmd: UpdateProfileCommand): Promise<ProfileDto> {
    const data = await request<any>('/users/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })
    return mapProfile(data)
  }

  async uploadAvatar(file: File): Promise<ProfileDto> {
    const form = new FormData(); form.append('file', file)
    return mapProfile(await request('/users/me/avatar', { method: 'POST', body: form }))
  }

  async removeAvatar(): Promise<ProfileDto> { return mapProfile(await request('/users/me/avatar', { method: 'DELETE' })) }

  async changePassword(cmd: ChangePasswordCommand): Promise<void> {
    await request('/users/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })
  }

  async setProjectPublic(_projectId: string, _isPublic: boolean): Promise<ProfileProjectDto> {
    throw new Error('The backend does not provide an API to change project visibility yet.')
  }
  async updatePrivacy(_cmd: ProfilePrivacyDto): Promise<ProfilePrivacyDto> {
    throw new Error('The backend does not provide an API to update privacy settings yet.')
  }
  async deactivateAccount(): Promise<void> { throw new Error('The backend does not provide an account deactivation API yet.') }
  async deleteAccount(_cmd: DeleteAccountCommand): Promise<void> { throw new Error('The backend does not provide an account deletion API yet.') }
}
