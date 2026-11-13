import { apiRequest } from '../../http/apiClient'
import type { AuditLogAction, AuditLogItem, AuditScope, ProjectRole } from '../../../types/settings.types'

export type ProjectActivityType =
  | 'PROJECT_CREATED'
  | 'PROJECT_STATUS_CHANGED'
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'INVITATION_SENT'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED'
  | 'INVITATION_REVOKED'
  | 'INVITATION_EXPIRED'
  | 'TASK_STATUS_CHANGED'
  | 'ARTIFACT_SUBMITTED'
  | 'GUEST_LINK_CREATED'
  | 'GUEST_LINK_REVOKED'
  | 'FEEDBACK_CREATED'
  | (string & {})

export interface ProjectActivityItem {
  id: string
  type: ProjectActivityType
  actorName: string
  message: string
  targetCode: string | null
  createdAt: string
}

/**
 * FC5 — Gọi GET /projects/{id}/activity?limit=... lấy nhật ký hoạt động thật của dự án.
 * Dùng cho Settings → System audit log và tái sử dụng cho Overview (FC2).
 * Lưu ý: với task/node, backend chỉ trả trạng thái hiện tại và lần cập nhật gần nhất
 * vì DB không lưu lịch sử từng lần chuyển trạng thái.
 */
export async function fetchProjectActivity(
  projectId: string | number,
  limit = 50,
): Promise<ProjectActivityItem[]> {
  const data = await apiRequest<ProjectActivityItem[]>('GET', `/projects/${projectId}/activity`, {
    query: { limit },
  })
  return Array.isArray(data) ? data : []
}

function inferActivityScope(type: string): AuditScope {
  switch (type) {
    case 'MEMBER_JOINED':
    case 'MEMBER_REMOVED':
    case 'INVITATION_SENT':
    case 'INVITATION_ACCEPTED':
    case 'INVITATION_REJECTED':
    case 'INVITATION_REVOKED':
    case 'INVITATION_EXPIRED':
    case 'GUEST_LINK_CREATED':
    case 'GUEST_LINK_REVOKED':
      return 'Access'
    case 'PROJECT_CREATED':
    case 'PROJECT_STATUS_CHANGED':
    case 'TASK_STATUS_CHANGED':
    case 'ARTIFACT_SUBMITTED':
    case 'FEEDBACK_CREATED':
      return 'Lifecycle'
    default:
      return 'Governance'
  }
}

function inferActivityActorRole(type: string, actorName: string): ProjectRole | 'SYSTEM' {
  if (actorName === 'SYSTEM' || type === 'INVITATION_EXPIRED') return 'SYSTEM'
  switch (type) {
    case 'PROJECT_CREATED':
    case 'PROJECT_STATUS_CHANGED':
    case 'GUEST_LINK_CREATED':
    case 'GUEST_LINK_REVOKED':
    case 'INVITATION_SENT':
    case 'INVITATION_REVOKED':
      return 'OWNER'
    case 'FEEDBACK_CREATED':
      return 'VIEWER'
    default:
      return 'COLLABORATOR'
  }
}

export function mapActivityToAuditLog(item: ProjectActivityItem): AuditLogItem {
  const actorName = item.actorName || 'Hệ thống'
  return {
    id: item.id,
    timestamp: item.createdAt,
    actor: {
      userId: actorName === 'SYSTEM' ? 'system' : '',
      name: actorName,
      role: inferActivityActorRole(item.type, actorName),
    },
    action: item.type as AuditLogAction,
    details: item.message,
    scope: inferActivityScope(item.type),
    type: item.type,
    targetCode: item.targetCode ?? null,
  }
}
