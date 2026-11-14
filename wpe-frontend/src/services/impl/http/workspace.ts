import { apiRequest, getStoredUserId } from '../../http/apiClient'
import type { ProjectRole, ProjectStatus, ProjectSummaryDto } from '../../../types/workspace.types'

export interface FetchProjectsParams {
  tab?: 'all' | 'mine' | 'shared' | 'archived'
  sort?: 'ts' | 'done' | 'nodes'
}

export interface BackendProjectSummaryResponse {
  id: number | string
  name: string
  description?: string
  status?: string
  ownerId?: number | string
  ownerName?: string
  totalNodes?: number
  completedNodes?: number
  inProgressNodes?: number
  progressPercentage?: number
  createdAt?: string
  updatedAt?: string
  nodeCount?: number
  activeNodes?: number
  doneNodes?: number
  criticalPathLength?: number
  completionPercent?: number
  role?: string
  members?: Array<{ id: number | string; displayName?: string; username?: string }>
}

/**
 * D1 — Lời gọi API danh sách dự án và trạng thái dự án (Cụm 3.1, 3.2).
 */

/** GET /projects?tab=&sort= */
export async function fetchProjects(params?: FetchProjectsParams): Promise<ProjectSummaryDto[]> {
  const query: Record<string, string | undefined> = {}
  if (params?.tab) query.tab = params.tab
  if (params?.sort) query.sort = params.sort

  const data = await apiRequest<BackendProjectSummaryResponse[]>('GET', '/projects', {
    query: Object.keys(query).length > 0 ? query : undefined,
  })

  const currentUserId = getStoredUserId()

  return (data || []).map((item) => {
    const itemOwnerId = item.ownerId != null ? String(item.ownerId) : undefined
    const computedRole: ProjectRole = item.role
      ? (item.role as ProjectRole)
      : (currentUserId && itemOwnerId && currentUserId === itemOwnerId ? 'OWNER' : 'COLLABORATOR')
    const totalNodes = item.nodeCount ?? item.totalNodes ?? 0
    const doneNodes = item.doneNodes ?? item.completedNodes ?? 0
    const activeNodes = item.activeNodes ?? item.inProgressNodes ?? 0

    return {
      id: String(item.id),
      name: item.name,
      description: item.description || '',
      status: (item.status || 'ACTIVE') as ProjectStatus,
      ownerId: itemOwnerId,
      ownerName: item.ownerName || '',
      role: computedRole,
      nodeCount: totalNodes,
      totalNodes: totalNodes,
      completedNodes: doneNodes,
      inProgressNodes: activeNodes,
      completionPercent: item.progressPercentage != null ? Math.round(item.progressPercentage) : (item.completionPercent ?? 0),
      progressPercentage: item.progressPercentage ?? item.completionPercent ?? 0,
      criticalPathLength: item.criticalPathLength ?? 0,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      members: (item.members || (item.ownerName ? [{ id: String(item.ownerId || '1'), displayName: item.ownerName }] : [])).map((m) => ({
        id: String(m.id),
        displayName: m.displayName || m.username || 'Member',
      })),
    }
  })
}

/** PATCH /projects/{projectId}/status */
export function setProjectStatus(
  projectId: string | number,
  status: ProjectStatus | string,
): Promise<BackendProjectSummaryResponse> {
  return apiRequest<BackendProjectSummaryResponse>('PATCH', `/projects/${projectId}/status`, {
    body: { status },
  })
}

/** DELETE /projects/{projectId} */
export function deleteProject(projectId: string | number): Promise<void> {
  return apiRequest<void>('DELETE', `/projects/${projectId}`)
}
