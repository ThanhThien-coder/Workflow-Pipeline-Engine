import { MockWorkflowService } from '../MockWorkflowService'
import type { ArtifactItem, ArtifactType, KanbanTask, PhaseId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'

interface BackendTaskResponse {
  id: string
  phaseId?: string
  code: string
  title: string
  description?: string
  status: string
  assignedUserId?: string
  joinPolicy: string
  rejectReason?: string
  dueDate?: string
  isOverdue: boolean
  version: number
  artifacts?: Array<{
    id: string
    type: string
    url: string
    note?: string
    label?: string
    uploadedAt: string
  }>
}

export class HttpWorkflowService extends MockWorkflowService {
  private taskVersionCache: Map<string, number> = new Map()

  /**
   * Gọi API thật GET /api/v1/projects/{projectId}/my-tasks
   */
  async getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/my-tasks?userId=${userId}`, {
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        console.warn(`[HttpWorkflowService] Backend trả về ${res.status}, chuyển sang mock fallback.`)
        return super.getMyTasks(projectId, userId)
      }

      const data: BackendTaskResponse[] = await res.json()
      
      // Lưu version vào cache để phục vụ Optimistic Locking khi update
      data.forEach(item => this.taskVersionCache.set(String(item.id), item.version))

      return data.map(item => this.mapBackendTaskToKanban(item))
    } catch (error) {
      console.warn('[HttpWorkflowService] Không thể kết nối backend, chuyển sang mock fallback:', error)
      return super.getMyTasks(projectId, userId)
    }
  }

  /**
   * Gọi API thật PATCH /api/v1/nodes/{taskId}/status
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask> {
    try {
      const currentVersion = this.taskVersionCache.get(taskId) ?? 0

      const res = await fetch(`${API_BASE_URL}/nodes/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          rejectReason: rejectReason || null,
          version: currentVersion
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        const errorMessage = errorData?.message || `Cập nhật trạng thái thất bại (HTTP ${res.status})`
        throw new Error(errorMessage)
      }

      const updated: BackendTaskResponse = await res.json()
      this.taskVersionCache.set(String(updated.id), updated.version)
      return this.mapBackendTaskToKanban(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cập nhật trạng thái thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi API updateStatus:', error)
      return super.updateTaskStatus(taskId, newStatus, rejectReason)
    }
  }

  /**
   * Gọi API thật POST /api/v1/nodes/{taskId}/submit
   */
  async submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> {
    try {
      const currentVersion = this.taskVersionCache.get(dto.taskId) ?? 0

      const res = await fetch(`${API_BASE_URL}/nodes/${dto.taskId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          taskId: dto.taskId,
          type: dto.type,
          url: dto.url,
          note: dto.note,
          version: currentVersion
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Nộp bài thất bại (HTTP ${res.status})`)
      }

      const result = await res.json()
      const task = this.mapBackendTaskToKanban(result.task)
      this.taskVersionCache.set(String(result.task.id), result.task.version)

      const artifact: ArtifactItem = {
        id: result.artifact?.id || `art-${Date.now()}`,
        type: (result.artifact?.type || dto.type) as ArtifactType,
        url: result.artifact?.url || dto.url,
        note: result.artifact?.note || dto.note,
        uploadedAt: result.artifact?.uploadedAt || new Date().toISOString()
      }

      return { task, artifact }
    } catch (error) {
      console.warn('[HttpWorkflowService] Lỗi khi gọi API submitTaskArtifact:', error)
      return super.submitTaskArtifact(dto)
    }
  }

  /**
   * Đăng ký kênh thời gian thực Real-time SSE
   */
  connectRealtime(userId: string, onEvent: (eventName: string, data: any) => void): () => void {
    const sseUrl = `${API_BASE_URL}/realtime/subscribe?userId=${userId}`
    const eventSource = new EventSource(sseUrl)

    eventSource.addEventListener('INIT', (e) => {
      console.log('[SSE] Đã kết nối đường ống thời gian thực:', e.data)
    })

    eventSource.addEventListener('TASK_UNLOCKED', (e) => {
      try {
        const task = JSON.parse(e.data)
        onEvent('TASK_UNLOCKED', this.mapBackendTaskToKanban(task))
      } catch (err) {
        console.error('[SSE] Lỗi parse dữ liệu TASK_UNLOCKED:', err)
      }
    })

    eventSource.addEventListener('TASK_STATUS_CHANGED', (e) => {
      try {
        const task = JSON.parse(e.data)
        onEvent('TASK_STATUS_CHANGED', this.mapBackendTaskToKanban(task))
      } catch (err) {
        console.error('[SSE] Lỗi parse dữ liệu TASK_STATUS_CHANGED:', err)
      }
    })

    eventSource.addEventListener('NOTIFICATION_RECEIVED', (e) => {
      try {
        const notif = JSON.parse(e.data)
        onEvent('NOTIFICATION_RECEIVED', notif)
      } catch (err) {
        console.error('[SSE] Lỗi parse dữ liệu NOTIFICATION_RECEIVED:', err)
      }
    })

    return () => {
      eventSource.close()
    }
  }

  private mapBackendTaskToKanban(item: BackendTaskResponse): KanbanTask {
    const phaseMap: Record<string, PhaseId> = { '1': 'P1', '2': 'P2A', '3': 'P2B', '4': 'P3' }
    const phaseId: PhaseId = phaseMap[item.phaseId || '1'] || 'P1'

    return {
      id: String(item.id),
      code: item.code,
      title: item.title,
      description: item.description || '',
      status: item.status as TaskStatus,
      assignedUserId: String(item.assignedUserId || '1'),
      phaseId,
      phaseLabel: item.phaseId ? `Phase ${item.phaseId}` : 'Foundation',
      dueDate: item.dueDate || new Date().toISOString(),
      isOverdue: item.isOverdue || false,
      joinPolicySummary: item.joinPolicy === 'ALL_COMPLETED' ? 'AND-Join: Tất cả tiền đề hoàn thành' : 'OR-Join: 1 tiền đề hoàn thành',
      artifacts: (item.artifacts || []).map(a => ({
        id: String(a.id),
        type: a.type as ArtifactType,
        url: a.url,
        note: a.note || '',
        label: a.label,
        uploadedAt: a.uploadedAt
      })),
      version: item.version,
      rejectReason: item.rejectReason
    }
  }
}
