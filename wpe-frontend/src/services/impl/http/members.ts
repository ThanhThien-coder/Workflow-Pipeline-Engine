import { apiRequest } from '../../http/apiClient'
import type {
  InviteMemberCommand,
  ProjectInvitationDto,
  ProjectMemberDetail,
  ProjectMemberHistoryItem,
  ProjectRole,
} from '../../../types/settings.types'

const AVATAR_CLASSES = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
]

/** Sinh màu avatar ổn định theo userId khi backend không có */
export function getStableAvatarClass(userId: string | number): string {
  const str = String(userId)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length]
}

export interface BackendMemberResponse {
  userId: string | number
  username: string
  fullName?: string | null
  email?: string | null
  role: string
  joinedAt?: string
  activeNodeCount?: number
  initials?: string
  avatarUrl?: string | null
}

export function mapMemberResponse(item: BackendMemberResponse): ProjectMemberDetail {
  const uid = String(item.userId)
  const username = item.username || ''
  const initials = item.initials || (username ? username.slice(0, 2).toUpperCase() : 'U')
  return {
    userId: uid,
    username,
    email: item.email || '',
    role: item.role as ProjectRole,
    joinedAt: item.joinedAt ? new Date(item.joinedAt).toISOString() : new Date().toISOString(),
    activeNodeCount: item.activeNodeCount ?? 0,
    avatarClass: getStableAvatarClass(uid),
    initials,
    avatarUrl: item.avatarUrl || null,
  }
}

export interface BackendMemberHistoryResponse {
  userId: string | number
  username: string
  fullName?: string | null
  role: string
  joinedAt?: string
  removedAt?: string | null
  active: boolean
}

export interface BackendInvitationResponse {
  id: string | number
  projectId: string | number
  projectName?: string
  inviterId?: string | number
  inviterName?: string
  inviterEmail?: string
  inviteeId?: string | number
  inviteeEmail: string
  role: 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
  status: any
  createdAt?: string
  expiresAt?: string
  version?: number
}

export function mapInvitationResponse(item: BackendInvitationResponse): ProjectInvitationDto {
  return {
    id: String(item.id),
    projectId: String(item.projectId),
    projectName: item.projectName || '',
    inviterId: String(item.inviterId || '1'),
    inviterName: item.inviterName || 'Workspace Owner',
    inviterEmail: item.inviterEmail,
    inviteeId: item.inviteeId != null ? String(item.inviteeId) : undefined,
    inviteeEmail: item.inviteeEmail,
    role: item.role,
    status: item.status,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
    version: item.version != null ? Number(item.version) : undefined,
  }
}

/**
 * D2 — Lời gọi API quản lý thành viên, lời mời và lịch sử (Cụm 3.3, 3.4).
 */

/** GET /projects/{projectId}/members */
export async function listMembers(projectId: string | number): Promise<ProjectMemberDetail[]> {
  const data = await apiRequest<BackendMemberResponse[]>('GET', `/projects/${projectId}/members`)
  return (data || []).map(mapMemberResponse)
}

/** PATCH /projects/{projectId}/members/{userId} */
export async function changeRole(
  projectId: string | number,
  userId: string | number,
  role: ProjectRole,
): Promise<ProjectMemberDetail> {
  const data = await apiRequest<BackendMemberResponse>('PATCH', `/projects/${projectId}/members/${userId}`, {
    body: { role },
  })
  return mapMemberResponse(data)
}

/** DELETE /projects/{projectId}/members/{userId} */
export async function removeMember(
  projectId: string | number,
  userId: string | number,
): Promise<{ unassignedTaskCount: number; userId?: number | string }> {
  const data = await apiRequest<{ userId?: number | string; unassignedTaskCount?: number }>(
    'DELETE',
    `/projects/${projectId}/members/${userId}`,
  )
  return {
    userId: data?.userId,
    unassignedTaskCount: data?.unassignedTaskCount ?? 0,
  }
}

/** GET /projects/{projectId}/members/history */
export async function listMemberHistory(projectId: string | number): Promise<ProjectMemberHistoryItem[]> {
  const data = await apiRequest<BackendMemberHistoryResponse[]>('GET', `/projects/${projectId}/members/history`)
  return (data || []).map((item) => ({
    userId: String(item.userId),
    username: item.username,
    fullName: item.fullName ?? null,
    role: item.role as ProjectRole,
    joinedAt: item.joinedAt ? new Date(item.joinedAt).toISOString() : new Date().toISOString(),
    removedAt: item.removedAt ? new Date(item.removedAt).toISOString() : null,
    active: Boolean(item.active),
  }))
}

/** POST /projects/{projectId}/invitations */
export async function createInvitation(
  projectId: string | number,
  cmd: InviteMemberCommand,
): Promise<ProjectInvitationDto> {
  const data = await apiRequest<BackendInvitationResponse>('POST', `/projects/${projectId}/invitations`, {
    body: {
      inviteeEmailOrUsername: cmd.usernameOrEmail,
      role: cmd.role,
    },
  })
  return mapInvitationResponse(data)
}

/** GET /projects/{projectId}/invitations */
export async function listPendingInvitations(projectId: string | number): Promise<ProjectInvitationDto[]> {
  const data = await apiRequest<BackendInvitationResponse[]>('GET', `/projects/${projectId}/invitations`)
  return (data || []).map(mapInvitationResponse)
}

/** DELETE /projects/{projectId}/invitations/{invitationId} */
export async function revokeInvitation(
  projectId: string | number,
  invitationId: string | number,
): Promise<boolean> {
  await apiRequest<void>('DELETE', `/projects/${projectId}/invitations/${invitationId}`)
  return true
}
