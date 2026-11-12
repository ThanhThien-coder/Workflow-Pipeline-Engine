import { apiRequest } from '../../http/apiClient'
import { ApiError } from '../../http/ApiError'
import type { BackendDependencyDto, BackendGraphNodeDto, BackendGraphResponse, BackendPhaseDto } from '../../../types/workflow.types'

/**
 * B5 — Lời gọi API đồ thị (Cụm 4 của integration map). Chỉ gọi HTTP và trả dữ liệu thô của backend;
 * đổi sang mô hình FE là việc của mappers/graphMapper.ts.
 * Lỗi luôn là ApiError (apiClient ném), không bao giờ rơi về dữ liệu giả.
 */

/** GET /projects/{id}/graph */
export function fetchGraph(projectId: string): Promise<BackendGraphResponse> {
  return apiRequest<BackendGraphResponse>('GET', `/projects/${projectId}/graph`)
}

export interface CreatePhaseBody {
  name: string
  sub?: string
  accent?: string
  parentPhaseId: number | null
}

/** POST /projects/{id}/phases */
export function createPhase(projectId: string, body: CreatePhaseBody): Promise<BackendPhaseDto> {
  return apiRequest<BackendPhaseDto>('POST', `/projects/${projectId}/phases`, { body })
}

export interface UpdatePhaseBody {
  /** Backend bắt buộc có name (@NotBlank), kể cả khi chỉ đổi vị trí. */
  name: string
  /** Không gửi thì backend giữ vị trí cũ. */
  uiMetadata?: { x: number; y: number; w: number; h: number }
}

/** PUT /projects/{id}/phases/{phaseId}. Trường không gửi thì backend giữ nguyên. */
export function updatePhase(projectId: string, phaseId: string, body: UpdatePhaseBody): Promise<BackendPhaseDto> {
  return apiRequest<BackendPhaseDto>('PUT', `/projects/${projectId}/phases/${phaseId}`, { body })
}

/** POST /projects/{id}/phases/connect?sourcePhaseId=&targetPhaseId=. Tạo vòng thì 422 CYCLE_DETECTED. */
export async function connectPhases(projectId: string, sourcePhaseId: string, targetPhaseId: string): Promise<void> {
  await apiRequest<unknown>('POST', `/projects/${projectId}/phases/connect`, { query: { sourcePhaseId, targetPhaseId } })
}

/** POST /projects/{id}/phases/disconnect?sourcePhaseId=&targetPhaseId= */
export async function disconnectPhases(projectId: string, sourcePhaseId: string, targetPhaseId: string): Promise<void> {
  await apiRequest<unknown>('POST', `/projects/${projectId}/phases/disconnect`, { query: { sourcePhaseId, targetPhaseId } })
}

/** DELETE /projects/{id}/phases/{phaseId} */
export async function deletePhase(projectId: string, phaseId: string): Promise<void> {
  await apiRequest<void>('DELETE', `/projects/${projectId}/phases/${phaseId}`)
}

/** POST /projects/{id}/nodes. Node trong phase được backend tạo ở trạng thái LOCKED. */
export function createNode(projectId: string, body: { phaseId: number | null; title: string }): Promise<BackendGraphNodeDto> {
  return apiRequest<BackendGraphNodeDto>('POST', `/projects/${projectId}/nodes`, { body })
}

/** POST /projects/{id}/dependencies. Tạo vòng thì 422 CYCLE_DETECTED kèm cycleNodes. */
export function createDependency(projectId: string, parentNodeId: number, childNodeId: number): Promise<BackendDependencyDto> {
  return apiRequest<BackendDependencyDto>('POST', `/projects/${projectId}/dependencies`, { body: { parentNodeId, childNodeId } })
}

/** POST /projects/{id}/publish */
export function publishProject(projectId: string): Promise<{ status?: string; unlockedTaskCount?: number }> {
  return apiRequest('POST', `/projects/${projectId}/publish`)
}

/**
 * Id phase/node của backend là số. Node mới tạo cục bộ trên canvas (id kiểu "task-1731...") chưa có trên
 * backend, gửi lên sẽ nhận 400 khó hiểu, nên báo lỗi rõ ngay ở FE.
 */
export function toBackendId(id: string, what: string): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError({
      status: 400,
      code: 'NODE_NOT_SAVED',
      message: `${what} "${id}" chưa được lưu lên máy chủ. Tải lại đồ thị rồi thử lại.`,
    })
  }
  return n
}

/**
 * Debounce theo từng khóa (mỗi phase một hàng chờ riêng).
 * Gọi nhiều lần trong `delayMs` thì chỉ chạy lần cuối; mọi Promise đã trả ra đều xong cùng lúc với lần chạy đó.
 * Khóa khác nhau không chờ nhau (Auto Layout đổi 5 phase thì vẫn gửi đủ 5 request).
 */
export function createKeyedDebounce(delayMs: number) {
  const pending = new Map<string, {
    timer: ReturnType<typeof setTimeout>
    waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }>
  }>()

  return function schedule(key: string, task: () => Promise<unknown>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const previous = pending.get(key)
      if (previous) clearTimeout(previous.timer)
      const waiters = [...(previous?.waiters ?? []), { resolve, reject }]

      const timer = setTimeout(() => {
        pending.delete(key)
        task().then(
          () => waiters.forEach((w) => w.resolve()),
          (error: unknown) => waiters.forEach((w) => w.reject(error)),
        )
      }, delayMs)

      pending.set(key, { timer, waiters })
    })
  }
}

export const PHASE_POSITION_DEBOUNCE_MS = 300
