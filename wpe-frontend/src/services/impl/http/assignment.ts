import { apiRequest } from '../../http/apiClient'
import type { KanbanTask } from '../../../types/kanban.types'

export interface UpdateTaskAssignmentCommand {
  assignedUserId?: string
  dueDate?: string
  version: number
}

export interface GraphNodeResponse {
  id: number | string
  phaseId?: number | string
  code?: string
  title?: string
  description?: string
  status?: string
  joinPolicy?: string
  assignedUserId?: number | string | null
  dueDate?: string | null
  estimatedHours?: number | null
  version: number | string
  uiMetadata?: unknown
}

/**
 * Cụm 8 — Đổi người làm và hạn chót cho Owner / Manager (PATCH /nodes/{id}/assignment).
 */
export async function patchAssignment(
  taskId: string | number,
  cmd: UpdateTaskAssignmentCommand
): Promise<Pick<KanbanTask, 'assignedUserId' | 'dueDate' | 'version'>> {
  const body: Record<string, unknown> = {
    version: cmd.version,
  }

  if (cmd.assignedUserId !== undefined && cmd.assignedUserId !== '') {
    const trimmed = String(cmd.assignedUserId).trim()
    const isNumeric = /^\d+$/.test(trimmed)
    body.assignedUserId = isNumeric ? Number(trimmed) : trimmed
  }

  if (cmd.dueDate !== undefined && cmd.dueDate !== '') {
    body.dueDate = cmd.dueDate
  }

  const res = await apiRequest<GraphNodeResponse>('PATCH', `/nodes/${taskId}/assignment`, {
    body,
  })

  return {
    assignedUserId: String(res.assignedUserId ?? ''),
    dueDate: res.dueDate ?? '',
    version: Number(res.version),
  }
}
