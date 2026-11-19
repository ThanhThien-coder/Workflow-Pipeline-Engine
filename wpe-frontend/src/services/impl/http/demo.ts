import { apiRequest } from '../../http/apiClient'
import type { NodeStatus } from '../../../types/workflow.types'

/**
 * TASK_74 — Lời gọi API công cụ demo (backend TASK_68, DemoToolsController).
 * Mặc định backend tắt (app.demo-tools.enabled=false): các hàm ghi sẽ trả lỗi 404/403.
 */

export interface DemoOverdueScanResult {
  overdueCount: number
}

export interface DemoCompleteAllResult {
  completedCount: number
}

export interface DemoExpireInvitationsResult {
  expiredCount: number
}

/** GET /demo/status. Lỗi bất kỳ (mạng, 401, 404...) coi như tắt. */
export async function fetchDemoStatus(): Promise<boolean> {
  try {
    const res = await apiRequest<{ enabled?: boolean } | undefined>('GET', '/demo/status')
    return res?.enabled === true
  } catch {
    return false
  }
}

const base = (projectId: string | number) => `/demo/projects/${projectId}`

/** POST /demo/projects/{projectId}/nodes/{nodeId}/make-overdue */
export function makeOverdue(projectId: string | number, nodeId: string | number): Promise<unknown> {
  return apiRequest('POST', `${base(projectId)}/nodes/${nodeId}/make-overdue`)
}

/** POST /demo/projects/{projectId}/overdue-scan */
export function runOverdueScan(projectId: string | number): Promise<DemoOverdueScanResult> {
  return apiRequest('POST', `${base(projectId)}/overdue-scan`)
}

/** POST /demo/projects/{projectId}/nodes/{nodeId}/force-status  body { status } */
export function forceStatus(projectId: string | number, nodeId: string | number, status: NodeStatus): Promise<unknown> {
  return apiRequest('POST', `${base(projectId)}/nodes/${nodeId}/force-status`, { body: { status } })
}

/** POST /demo/projects/{projectId}/phases/{phaseId}/complete-all */
export function completeAllInPhase(projectId: string | number, phaseId: string | number): Promise<DemoCompleteAllResult> {
  return apiRequest('POST', `${base(projectId)}/phases/${phaseId}/complete-all`)
}

/** POST /demo/projects/{projectId}/ai-cooldown/reset (204) */
export async function resetAiCooldown(projectId: string | number): Promise<void> {
  await apiRequest('POST', `${base(projectId)}/ai-cooldown/reset`)
}

/** POST /demo/projects/{projectId}/guest-link/expire (204) */
export async function expireGuestLink(projectId: string | number): Promise<void> {
  await apiRequest('POST', `${base(projectId)}/guest-link/expire`)
}

/** POST /demo/projects/{projectId}/invitations/expire */
export function expireInvitations(projectId: string | number): Promise<DemoExpireInvitationsResult> {
  return apiRequest('POST', `${base(projectId)}/invitations/expire`)
}

/** POST /demo/projects/{projectId}/notifications/test (204) */
export async function sendTestNotification(projectId: string | number): Promise<void> {
  await apiRequest('POST', `${base(projectId)}/notifications/test`)
}
