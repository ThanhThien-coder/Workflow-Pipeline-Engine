import { MockWorkflowService } from '../MockWorkflowService'
import type { ArtifactItem, ArtifactType, KanbanTask, PhaseId, SubmitArtifactDto, TaskStatus } from '../../types/kanban.types'
import type { ArtifactItem as ProjectArtifactItem, CreateArtifactCommand } from '../../types/artifact.types'
import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  ProjectDetailDto,
  ProjectRole,
  ProjectStatus,
  ProjectSummaryDto,
} from '../../types/workspace.types'
import type { ProjectInvitationDto, PublishPipelineResult } from '../../types/settings.types'
import type { MacroPhase, PhaseTreeData, BranchGraphNode, GhostGraphNode, PhaseAccent, PhaseStatus } from '../../types/workflow.types'
import type { CreatePhaseDto } from '../contracts/IWorkflowService'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('wpe_auth_token') || sessionStorage.getItem('wpe_auth_token'))
    : null
  const headers: Record<string, string> = {
    ...extraHeaders,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function getCurrentUserId(): string | null {
  try {
    const raw = typeof window !== 'undefined'
      ? (localStorage.getItem('wpe_auth_user') || sessionStorage.getItem('wpe_auth_user'))
      : null
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.id != null ? String(parsed.id) : null
  } catch {
    return null
  }
}

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
        headers: getAuthHeaders({ 'Accept': 'application/json' })
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
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }),
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
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }),
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
   * Gọi API thật GET /api/v1/projects/{projectId}/artifacts
   */
  async getProjectArtifacts(projectId: string): Promise<ProjectArtifactItem[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/artifacts?inRepo=true`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' })
      })

      if (!res.ok) {
        console.warn(`[HttpWorkflowService] getProjectArtifacts trả về ${res.status}, chuyển sang mock fallback.`)
        return super.getProjectArtifacts(projectId)
      }

      const data = await res.json()
      return (data || []).map((item: any) => ({
        id: String(item.id),
        projectId: String(item.projectId),
        nodeId: item.nodeId ? String(item.nodeId) : null,
        name: item.name,
        title: item.name,
        type: item.type,
        url: item.url,
        isInRepository: item.isInRepository ?? true,
        isPublicForGuest: item.isPublicForGuest ?? true,
        uploadedBy: item.uploadedBy ? String(item.uploadedBy) : null,
        createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''
      }))
    } catch (error) {
      console.warn('[HttpWorkflowService] Lỗi khi gọi getProjectArtifacts, chuyển sang mock fallback:', error)
      return super.getProjectArtifacts(projectId)
    }
  }

  /**
   * Gọi API thật POST /api/v1/projects/{projectId}/artifacts
   */
  async createArtifact(projectId: string, payload: CreateArtifactCommand): Promise<ProjectArtifactItem> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/artifacts`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }),
        body: JSON.stringify({
          name: payload.name,
          url: payload.url,
          type: payload.type || null,
          nodeId: payload.nodeId ? Number(payload.nodeId) : null,
          isInRepository: payload.isInRepository ?? true
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Thêm tài nguyên thất bại (HTTP ${res.status})`)
      }

      const item = await res.json()
      return {
        id: String(item.id),
        projectId: String(item.projectId),
        nodeId: item.nodeId ? String(item.nodeId) : null,
        name: item.name,
        title: item.name,
        type: item.type,
        url: item.url,
        isInRepository: item.isInRepository ?? true,
        isPublicForGuest: item.isPublicForGuest ?? true,
        uploadedBy: item.uploadedBy ? String(item.uploadedBy) : null,
        createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Thêm tài nguyên thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi createArtifact, chuyển sang mock fallback:', error)
      return super.createArtifact(projectId, payload)
    }
  }

  /**
   * Gọi API thật DELETE /api/v1/projects/{projectId}/artifacts/{artifactId}
   */
  async deleteArtifact(projectId: string, artifactId: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/artifacts/${artifactId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!res.ok && res.status !== 404) {
        throw new Error(`Xóa tài nguyên thất bại (HTTP ${res.status})`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Xóa tài nguyên thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi deleteArtifact, chuyển sang mock fallback:', error)
      return super.deleteArtifact(projectId, artifactId)
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

  /**
   * Gọi API thật GET /api/v1/projects
   */
  async getMyProjects(): Promise<readonly ProjectSummaryDto[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })

      if (!res.ok) {
        console.warn(`[HttpWorkflowService] Backend GET /projects trả về ${res.status}, chuyển sang mock fallback.`)
        return super.getMyProjects()
      }

      const currentUserId = getCurrentUserId()
      const data: any[] = await res.json()
      return data.map((item) => {
        const itemOwnerId = item.ownerId != null ? String(item.ownerId) : undefined
        const computedRole: ProjectRole = item.role
          ? (item.role as ProjectRole)
          : (currentUserId && itemOwnerId && currentUserId === itemOwnerId ? 'OWNER' : 'COLLABORATOR')
        return {
          id: String(item.id),
          name: item.name,
          description: item.description || '',
          status: (item.status || 'ACTIVE') as ProjectStatus,
          ownerId: itemOwnerId,
          ownerName: item.ownerName || '',
          role: computedRole,
          nodeCount: item.totalNodes ?? item.nodeCount ?? 0,
          totalNodes: item.totalNodes ?? item.nodeCount ?? 0,
          completedNodes: item.completedNodes ?? 0,
          inProgressNodes: item.inProgressNodes ?? 0,
          completionPercent: item.progressPercentage != null ? Math.round(item.progressPercentage) : (item.completionPercent ?? 0),
          progressPercentage: item.progressPercentage ?? item.completionPercent ?? 0,
          criticalPathLength: item.criticalPathLength ?? 0,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          members: (item.members || (item.ownerName ? [{ id: String(item.ownerId || '1'), displayName: item.ownerName }] : [])).map((m: any) => ({
            id: String(m.id),
            displayName: m.displayName || m.username || 'Member',
          })),
        }
      })
    } catch (error) {
      console.warn('[HttpWorkflowService] Không thể kết nối backend GET /projects, chuyển sang mock fallback:', error)
      return super.getMyProjects()
    }
  }

  async getProjectsList(): Promise<readonly ProjectSummaryDto[]> {
    return this.getMyProjects()
  }

  /**
   * Gọi API thật POST /api/v1/projects
   */
  async createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify({
          name: cmd.name,
          description: cmd.desc ?? cmd.description ?? '',
          templateId: cmd.templateId ? Number(cmd.templateId) : null,
          visibility: cmd.visibility || 'PRIVATE',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Tạo dự án thất bại (HTTP ${res.status})`)
      }

      const item = await res.json()
      return {
        id: String(item.id),
        name: item.name,
        description: item.description || '',
        status: (item.status || 'DRAFT') as ProjectStatus,
        ownerId: item.ownerId != null ? String(item.ownerId) : undefined,
        ownerName: item.ownerName || '',
        role: 'OWNER',
        nodeCount: item.totalNodes ?? item.nodeCount ?? 0,
        totalNodes: item.totalNodes ?? item.nodeCount ?? 0,
        completedNodes: item.completedNodes ?? 0,
        inProgressNodes: item.inProgressNodes ?? 0,
        criticalPathLength: item.criticalPathLength ?? 0,
        completionPercent: item.progressPercentage != null ? Math.round(item.progressPercentage) : 0,
        progressPercentage: item.progressPercentage ?? 0,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        members: (item.members || (item.ownerName ? [{ id: String(item.ownerId || '1'), displayName: item.ownerName }] : [])).map((m: any) => ({
          id: String(m.id),
          displayName: m.displayName || m.username || 'Member',
        })),
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tạo dự án thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi createProject, chuyển sang mock fallback:', error)
      return super.createProject(cmd)
    }
  }

  /**
   * Gọi API thật POST /api/v1/projects/clone-template
   */
  async cloneTemplate(req: CloneTemplateCommand | {
    templateId: string | number
    projectName: string
    description?: string
    visibility?: string
  }): Promise<ProjectDetailDto> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/clone-template`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify({
          templateId: Number(req.templateId),
          projectName: req.projectName.trim(),
          description: req.description?.trim() || '',
          visibility: req.visibility || 'PRIVATE',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Nhân bản quy trình thất bại (HTTP ${res.status})`)
      }

      const item = await res.json()
      return {
        id: String(item.id),
        name: item.name,
        description: item.description || '',
        status: (item.status || 'PLANNING') as ProjectStatus,
        ownerId: item.ownerId != null ? String(item.ownerId) : undefined,
        ownerName: item.ownerName || '',
        role: 'OWNER',
        totalNodes: item.totalNodes ?? item.nodeCount ?? 0,
        nodeCount: item.totalNodes ?? item.nodeCount ?? 0,
        completedNodes: item.completedNodes ?? 0,
        inProgressNodes: item.inProgressNodes ?? 0,
        completionPercent: item.progressPercentage != null ? Math.round(item.progressPercentage) : 0,
        progressPercentage: item.progressPercentage ?? 0,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        latestAiAnalysis: item.latestAiAnalysis || null,
        phases: (item.phases || []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          subTitle: p.subTitle || '',
          accentColor: p.accentColor || '',
          orderIndex: p.orderIndex ?? 0,
          nodeCount: p.nodeCount ?? 0,
        })),
        members: item.ownerName ? [{ id: String(item.ownerId || '1'), displayName: item.ownerName }] : [],
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Nhân bản quy trình thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi cloneTemplate, chuyển sang mock fallback:', error)
      return super.cloneTemplate(req)
    }
  }

  /**
   * Gọi API thật PATCH /api/v1/projects/{id}/status
   */
  async updateProjectStatus(projectId: string, status: ProjectStatus | string): Promise<ProjectSummaryDto> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Cập nhật trạng thái dự án thất bại (HTTP ${res.status})`)
      }

      const item = await res.json()
      return {
        id: String(item.id),
        name: item.name,
        description: item.description || '',
        status: (item.status || status) as ProjectStatus,
        ownerId: item.ownerId != null ? String(item.ownerId) : undefined,
        ownerName: item.ownerName || '',
        role: 'OWNER',
        nodeCount: item.totalNodes ?? 0,
        totalNodes: item.totalNodes ?? 0,
        completedNodes: item.completedNodes ?? 0,
        inProgressNodes: item.inProgressNodes ?? 0,
        criticalPathLength: 0,
        completionPercent: item.progressPercentage != null ? Math.round(item.progressPercentage) : 0,
        progressPercentage: item.progressPercentage ?? 0,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        members: [],
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cập nhật trạng thái dự án thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi updateProjectStatus, chuyển sang mock fallback:', error)
      return super.updateProjectStatus(projectId, status as ProjectStatus)
    }
  }

  /**
   * Gọi API thật GET /api/v1/invitations/{id}
   */
  async getInvitationDetail(invitationId: string): Promise<ProjectInvitationDto | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })

      if (!res.ok) {
        if (res.status === 404) return null
        console.warn(`[HttpWorkflowService] getInvitationDetail trả về ${res.status}, chuyển sang mock fallback.`)
        return super.getInvitationDetail(invitationId)
      }

      const data = await res.json()
      return {
        id: String(data.id),
        projectId: String(data.projectId),
        projectName: data.projectName || '',
        inviterId: data.inviterId ? String(data.inviterId) : '1',
        inviterName: data.inviterName || 'Workspace Owner',
        inviterEmail: data.inviterEmail,
        inviteeEmail: data.inviteeEmail || '',
        role: data.role || 'COLLABORATOR',
        status: data.status || 'PENDING',
        createdAt: data.createdAt || new Date().toISOString(),
        expiresAt: data.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
      }
    } catch (error) {
      console.warn('[HttpWorkflowService] Lỗi khi gọi getInvitationDetail, chuyển sang mock fallback:', error)
      return super.getInvitationDetail(invitationId)
    }
  }

  async getInvitation(invitationId: string): Promise<ProjectInvitationDto | null> {
    return this.getInvitationDetail(invitationId)
  }

  /**
   * Gọi API thật POST /api/v1/invitations/{id}/accept
   */
  async acceptInvitation(invitationId: string): Promise<{ success: boolean; projectId?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Chấp nhận lời mời thất bại (HTTP ${res.status})`)
      }

      const data = await res.json().catch(() => ({}))
      return {
        success: true,
        projectId: data.projectId ? String(data.projectId) : undefined,
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Chấp nhận lời mời thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi acceptInvitation, chuyển sang mock fallback:', error)
      return super.acceptInvitation(invitationId)
    }
  }

  /**
   * Gọi API thật POST /api/v1/invitations/{id}/reject
   */
  async rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/invitations/${invitationId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Từ chối lời mời thất bại (HTTP ${res.status})`)
      }

      return { success: true }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Từ chối lời mời thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Lỗi khi gọi rejectInvitation, chuyển sang mock fallback:', error)
      return super.rejectInvitation(invitationId)
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

  /**
   * Gọi API thật GET /api/v1/projects/{id}/graph
   */
  async getMacroPhases(projectId?: string): Promise<MacroPhase[]> {
    const pid = projectId || '1'
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${pid}/graph`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })
      if (!res.ok) {
        console.warn(`[HttpWorkflowService] getMacroPhases returned ${res.status}, falling back to mock.`)
        return super.getMacroPhases(projectId)
      }
      const data = await res.json()
      if (!data.phases || data.phases.length === 0) {
        return super.getMacroPhases(projectId)
      }
      return data.phases.map((p: any, idx: number) => ({
        id: String(p.id),
        name: p.name,
        sub: p.sub || '',
        accent: (p.accent as PhaseAccent) || 'slate',
        // Backend tính sẵn tiến độ & trạng thái Phase từ task (cùng công thức với domain/phaseProgress)
        status: (p.status || 'TODO') as PhaseStatus,
        pct: typeof p.progressPct === 'number' ? p.progressPct : 0,
        x: 60 + (p.orderIndex ?? idx) * 360,
        y: 80,
        w: 260,
        h: 128,
        parentPhaseIds: (p.parentPhaseIds || []).map(String),
        locked: p.status === 'LOCKED',
      }))
    } catch (error) {
      console.warn('[HttpWorkflowService] Error in getMacroPhases, falling back to mock:', error)
      return super.getMacroPhases(projectId)
    }
  }

  async getPhaseEdges(projectId?: string): Promise<[string, string][]> {
    const pid = projectId || '1'
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${pid}/graph`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })
      if (!res.ok) {
        return super.getPhaseEdges(projectId)
      }
      const data = await res.json()
      if (!data.phaseEdges) {
        return super.getPhaseEdges(projectId)
      }
      return (data.phaseEdges as string[][]).map(([from, to]) => [String(from), String(to)])
    } catch {
      return super.getPhaseEdges(projectId)
    }
  }

  async getPhaseGraph(phaseId: string, projectId?: string): Promise<PhaseTreeData> {
    const pid = projectId || '1'
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${pid}/graph`, {
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })
      if (!res.ok) {
        return super.getPhaseGraph(phaseId, projectId)
      }
      const data = await res.json()
      const phase = (data.phases || []).find((p: any) => String(p.id) === String(phaseId))
      if (!phase) {
        return super.getPhaseGraph(phaseId, projectId)
      }

      // Phase chưa có node vẫn trả về cây chỉ có root (không lấy dữ liệu Mock của project khác)
      const phaseNodes = (data.nodes || []).filter((n: any) => String(n.phaseId) === String(phaseId))

      const rootId = `root_${phaseId}`
      const tree: PhaseTreeData = {
        [rootId]: {
          id: rootId,
          kind: 'root',
          title: phase.name,
          parentIds: [],
          x: 80,
          y: 200,
        },
      }

      for (const n of phaseNodes) {
        const branch: BranchGraphNode = {
          id: String(n.id),
          kind: 'branch',
          code: n.code,
          title: n.title,
          description: n.description || '',
          isTrack: false,
          status: (n.status as any) || 'LOCKED',
          assignee: n.assignedUserId ? String(n.assignedUserId) : null,
          due: n.dueDate ? n.dueDate.split('T')[0] : null,
          blocker: null,
          joinPolicy: n.joinPolicy === 'ANY_COMPLETED' ? 'ANY_COMPLETED' : 'ALL_COMPLETED',
          phaseId: String(phaseId),
          parentIds: [rootId],
          x: n.uiMetadata?.position?.x ?? 280,
          y: n.uiMetadata?.position?.y ?? 180,
          width: n.uiMetadata?.width ?? 220,
          height: n.uiMetadata?.height ?? 90,
        }
        tree[String(n.id)] = branch
      }

      // Cross-phase ghost nodes
      for (const dep of data.dependencies || []) {
        if (phaseNodes.some((pn: any) => String(pn.id) === String(dep.childNodeId))) {
          const parentNode = (data.nodes || []).find((dn: any) => String(dn.id) === String(dep.parentNodeId))
          if (parentNode && String(parentNode.phaseId) !== String(phaseId)) {
            const ghostId = `ghost_${dep.parentNodeId}_to_${dep.childNodeId}`
            const sourcePhase = (data.phases || []).find((p: any) => String(p.id) === String(parentNode.phaseId))
            const ghostNode: GhostGraphNode = {
              id: ghostId,
              kind: 'ghost',
              refPhase: String(parentNode.phaseId || '1'),
              refId: String(dep.parentNodeId),
              dir: 'up',
              targetTaskId: String(dep.childNodeId),
              title: parentNode.title || 'Upstream Prerequisite',
              parentIds: [],
              sourceTaskTitle: parentNode.title,
              sourcePhaseTitle: sourcePhase?.name,
            }
            tree[ghostId] = ghostNode
          }
        }
      }

      return tree
    } catch (error) {
      console.warn('[HttpWorkflowService] Error in getPhaseGraph, falling back to mock:', error)
      return super.getPhaseGraph(phaseId, projectId)
    }
  }

  async createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase> {
    const pid = projectId || dto.projectId || '1'
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${pid}/phases`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }),
        body: JSON.stringify({
          name: dto.name,
          sub: dto.sub,
          accent: dto.accent,
          parentPhaseId: dto.parentPhaseId ? Number(dto.parentPhaseId) : null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || `Tạo Phase thất bại (HTTP ${res.status})`)
      }

      const item = await res.json()
      return {
        id: String(item.id),
        name: item.name,
        sub: item.sub || '',
        accent: (item.accent as PhaseAccent) || 'slate',
        status: 'TODO',
        pct: 0,
        x: dto.x ?? (60 + (item.orderIndex ?? 0) * 360),
        y: dto.y ?? 80,
        w: 260,
        h: 128,
        parentPhaseIds: (item.parentPhaseIds || []).map(String),
        locked: (item.parentPhaseIds || []).length > 0,
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tạo Phase thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Error in createPhase, falling back to mock:', error)
      return super.createPhase(dto, projectId)
    }
  }

  async connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    try {
      const res = await fetch(
        `${API_BASE_URL}/projects/${pid}/phases/connect?sourcePhaseId=${sourcePhaseId}&targetPhaseId=${targetPhaseId}`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Accept': 'application/json' }),
        }
      )
      if (!res.ok) {
        console.warn(`[HttpWorkflowService] connectPhases returned ${res.status}, falling back to mock.`)
        return super.connectPhases(sourcePhaseId, targetPhaseId, projectId)
      }
    } catch (error) {
      console.warn('[HttpWorkflowService] Error in connectPhases, falling back to mock:', error)
      return super.connectPhases(sourcePhaseId, targetPhaseId, projectId)
    }
  }

  async disconnectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    try {
      const res = await fetch(
        `${API_BASE_URL}/projects/${pid}/phases/disconnect?sourcePhaseId=${sourcePhaseId}&targetPhaseId=${targetPhaseId}`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Accept': 'application/json' }),
        }
      )
      if (!res.ok) {
        return super.disconnectPhases(sourcePhaseId, targetPhaseId, projectId)
      }
    } catch {
      return super.disconnectPhases(sourcePhaseId, targetPhaseId, projectId)
    }
  }

  async deletePhase(phaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${pid}/phases/${phaseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Xóa Phase thất bại (HTTP ${res.status})`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Xóa Phase thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Error in deletePhase, falling back to mock:', error)
      return super.deletePhase(phaseId, projectId)
    }
  }

  async publishPipeline(projectId: string): Promise<PublishPipelineResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}/publish`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Accept': 'application/json' }),
      })

      if (res.ok) {
        const data = await res.json()
        return {
          success: true,
          newStatus: (data.status || 'ACTIVE') as any,
        }
      }

      if (res.status === 422) {
        const errorData = await res.json().catch(() => ({}))
        return {
          success: false,
          cycleDetected: true,
          violatingNodeIds: errorData.cycleNodes || [],
        }
      }

      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.message || `Xuất bản quy trình thất bại (HTTP ${res.status})`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Xuất bản quy trình thất bại')) {
        throw error
      }
      console.warn('[HttpWorkflowService] Error in publishPipeline, falling back to mock:', error)
      return super.publishPipeline(projectId)
    }
  }
}
