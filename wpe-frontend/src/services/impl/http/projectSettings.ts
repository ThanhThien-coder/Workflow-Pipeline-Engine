import { apiRequest, getStoredUserId } from '../../http/apiClient'
import type { ProjectRole, ProjectSettingsDto, ProjectStatus } from '../../../types/settings.types'

/**
 * Thông tin chung của dự án cho màn Settings, lấy từ backend thật.
 *
 * Backend chưa có endpoint trả sẵn "vai trò của tôi trong dự án", nên tự suy ra:
 * - người đang đăng nhập là ownerId của dự án → OWNER (không cần gọi thêm);
 * - ngược lại tra GET /projects/{id}/members: có tên thì lấy vai trò ở đó;
 * - không có tên (ví dụ admin hệ thống) hoặc chưa đăng nhập → VIEWER (chỉ xem; backend vẫn là lớp chặn thật).
 */

/** ProjectDetailResponse của GET /projects/{id} (chỉ các trường màn Settings dùng). */
interface BackendProjectDetail {
  id: number | string
  name: string
  description?: string | null
  status: string
  ownerId: number | string
  createdAt?: string | null
  updatedAt?: string | null
}

/** ProjectMemberResponse của GET /projects/{id}/members (chỉ các trường cần). */
interface BackendProjectMember {
  userId: string | number
  role: string
}

export async function fetchProjectSettings(projectId: string): Promise<ProjectSettingsDto> {
  const detail = await apiRequest<BackendProjectDetail>('GET', `/projects/${projectId}`)
  const myRole = await resolveMyRole(projectId, String(detail.ownerId))

  return {
    id: String(detail.id),
    name: detail.name,
    description: detail.description ?? '',
    // Backend có thể trả PLANNING, PAUSED, COMPLETED; ProjectStatus của settings.types chưa có các giá trị này (file của D)
    status: detail.status as ProjectStatus,
    ownerId: String(detail.ownerId),
    myRole,
    createdAt: detail.createdAt ?? '',
    updatedAt: detail.updatedAt ?? '',
  }
}

async function resolveMyRole(projectId: string, ownerId: string): Promise<ProjectRole> {
  const me = getStoredUserId()
  if (!me) return 'VIEWER'
  if (me === ownerId) return 'OWNER'

  const members = await apiRequest<BackendProjectMember[]>('GET', `/projects/${projectId}/members`)
  const mine = (members || []).find((m) => String(m.userId) === me)
  // Backend gửi OWNER | MANAGER | COLLABORATOR | VIEWER, khớp ProjectRole (MANAGER thêm ở PR #33)
  return mine ? (mine.role as ProjectRole) : 'VIEWER'
}
