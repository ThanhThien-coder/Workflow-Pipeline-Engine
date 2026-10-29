import { MockAdminService } from './MockAdminService'
import type { AdminUserDto, SuspendUserRequestDto } from '../../types/admin.types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : (localStorage.getItem('wpe_auth_token') || sessionStorage.getItem('wpe_auth_token'))
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message || `Admin user API failed (HTTP ${response.status})`)
  }
  return response.json() as Promise<T>
}

export class HttpAdminService extends MockAdminService {
  getUsers(query?: string, status?: string): Promise<AdminUserDto[]> {
    const params = new URLSearchParams()
    if (query?.trim()) params.set('query', query.trim())
    if (status && status !== 'ALL') params.set('status', status)
    const suffix = params.size ? `?${params.toString()}` : ''
    return request(`/admin/users${suffix}`)
  }

  suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto> {
    return request(`/admin/users/${encodeURIComponent(payload.userId)}/suspend`, {
      method: 'POST', body: JSON.stringify({ reason: payload.reason, note: payload.note ?? null }),
    })
  }

  unbanUser(userId: string): Promise<AdminUserDto> {
    return request(`/admin/users/${encodeURIComponent(userId)}/unban`, { method: 'POST' })
  }
}
