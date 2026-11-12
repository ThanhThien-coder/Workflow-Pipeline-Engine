import { MockWorkflowService } from '../MockWorkflowService'
import type { CreatePhaseDto, IWorkflowService } from '../contracts/IWorkflowService'
import { apiRequest, API_BASE_URL, getStoredUserId } from '../http/apiClient'
import { ApiError, isApiError } from '../http/ApiError'
import * as authApi from './http/auth'
import type {
  ArtifactItem,
  ArtifactType,
  KanbanTask,
  PhaseId,
  SubmitArtifactDto,
  TaskStatus,
  UserSummary,
} from '../../types/kanban.types'
import type { ArtifactItem as ProjectArtifactItem, CreateArtifactCommand } from '../../types/artifact.types'
import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  ProjectDetailDto,
  ProjectRole,
  ProjectStatus,
  ProjectSummaryDto,
} from '../../types/workspace.types'
import type {
  AuditLogItem,
  ChangeMemberRoleCommand,
  InviteMemberCommand,
  ProjectInvitationDto,
  ProjectMemberDetail,
  ProjectSettingsDto,
  PublishPipelineResult,
  UpdateProjectCommand,
} from '../../types/settings.types'
import type { AuthCredentialsDto, AuthResponseDto, RegisterUserCommand, UserDto } from '../../types/auth.types'
import type { GuestAccessState, OverviewData } from '../../types/overview.types'
import type { MacroPhase, PhaseTreeData, BranchGraphNode, GhostGraphNode, PhaseAccent, PhaseStatus } from '../../types/workflow.types'

/**
 * A2 — Các phương thức CHƯA có backend (hoặc chưa nối) nên vẫn gọi mock một cách TƯỜNG MINH.
 * Mỗi dòng ghi mã task sẽ chuyển sang API thật. Task nào làm xong thì xóa dòng của mình.
 * Mọi phương thức KHÔNG nằm trong danh sách này đều gọi backend thật và lỗi thì ném ApiError
 * (không còn tự chuyển sang dữ liệu giả).
 */
export const METHODS_STILL_MOCKED = [
  'updatePhasePosition', // B5 (sau B2)
  'getOverviewData', // D5 (phần AI: D6)
  'resolveFeedback', // D5
  'toggleGuestAccess', // D5
  'generateGuestToken', // D5
  'getProjectMembers', // C6
  'getProjectSettings', // chưa có task: cần nhóm quyết (gần D1/D2)
  'updateProjectSettings', // chưa có task: cần nhóm quyết (gần D1/D2)
  'getProjectAuditLogs', // chưa có task: cần nhóm quyết
  'archiveProject', // D1 (PATCH /projects/{id}/status)
  'restoreProject', // D1 (PATCH /projects/{id}/status)
  'deleteProject', // D1
  'getProjectMembersDetailed', // D2
  'inviteProjectMember', // D2
  'changeMemberRole', // D2
  'removeProjectMember', // D2
  'createProjectInvitation', // D2
  'getProjectPendingInvitations', // D2
  'revokeInvitation', // D2
] as const satisfies readonly (keyof IWorkflowService)[]

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

/**
 * Gọi backend thật. Dùng composition thay cho kế thừa MockWorkflowService:
 * `mock` chỉ được gọi ở các phương thức nằm trong METHODS_STILL_MOCKED.
 * (Phần tách file theo mảng vào impl/http/ để sau sprint — xem A2 mục 4.)
 */
export class HttpWorkflowService implements IWorkflowService {
  private readonly mock = new MockWorkflowService()
  private taskVersionCache: Map<string, number> = new Map()

  // ───────────────────────── Auth (A4) — gọi /auth/* qua impl/http/auth.ts ─────────────────────────

  /** POST /auth/login */
  login(credentials: AuthCredentialsDto): Promise<AuthResponseDto> {
    return authApi.login(credentials)
  }

  /** POST /auth/register */
  register(cmd: RegisterUserCommand): Promise<AuthResponseDto> {
    return authApi.register(cmd)
  }

  /** User đã lưu khi đăng nhập (wpe_auth_user). Sau A5 có thể làm mới bằng GET /users/me/profile. */
  async getCurrentUser(): Promise<UserDto> {
    const user = authApi.getStoredUser()
    if (!user) throw authApi.notLoggedInError()
    return user
  }

  /** POST /auth/logout kèm refresh token đang lưu. */
  logout(): Promise<void> {
    return authApi.logout()
  }

  // ───────────────────────── Task (C) ─────────────────────────

  /** GET /projects/{projectId}/my-tasks?userId= */
  async getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]> {
    const data = await apiRequest<BackendTaskResponse[]>('GET', `/projects/${projectId}/my-tasks`, {
      query: { userId },
    })
    const items = data ?? []
    // Lưu version vào cache để phục vụ Optimistic Locking khi update
    items.forEach((item) => this.taskVersionCache.set(String(item.id), item.version))
    return items.map((item) => this.mapBackendTaskToKanban(item))
  }

  /** PATCH /nodes/{taskId}/status */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask> {
    const currentVersion = this.taskVersionCache.get(taskId) ?? 0
    const updated = await apiRequest<BackendTaskResponse>('PATCH', `/nodes/${taskId}/status`, {
      body: {
        status: newStatus,
        rejectReason: rejectReason || null,
        version: currentVersion,
      },
    })
    this.taskVersionCache.set(String(updated.id), updated.version)
    return this.mapBackendTaskToKanban(updated)
  }

  /** POST /nodes/{taskId}/submit */
  async submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> {
    const currentVersion = this.taskVersionCache.get(dto.taskId) ?? 0
    const result = await apiRequest<any>('POST', `/nodes/${dto.taskId}/submit`, {
      body: {
        taskId: dto.taskId,
        type: dto.type,
        url: dto.url,
        note: dto.note,
        version: currentVersion,
      },
    })

    const task = this.mapBackendTaskToKanban(result.task)
    this.taskVersionCache.set(String(result.task.id), result.task.version)

    const artifact: ArtifactItem = {
      id: result.artifact?.id || `art-${Date.now()}`,
      type: (result.artifact?.type || dto.type) as ArtifactType,
      url: result.artifact?.url || dto.url,
      note: result.artifact?.note || dto.note,
      uploadedAt: result.artifact?.uploadedAt || new Date().toISOString(),
    }

    return { task, artifact }
  }

  getProjectMembers(projectId: string): Promise<UserSummary[]> {
    return this.mock.getProjectMembers(projectId) // C6
  }

  // ───────────────────────── Artifact (C) ─────────────────────────

  /** GET /projects/{projectId}/artifacts?inRepo=true */
  async getProjectArtifacts(projectId: string): Promise<ProjectArtifactItem[]> {
    const data = await apiRequest<any[]>('GET', `/projects/${projectId}/artifacts`, {
      query: { inRepo: true },
    })
    return (data || []).map((item: any) => this.mapArtifact(item))
  }

  /** POST /projects/{projectId}/artifacts */
  async createArtifact(projectId: string, payload: CreateArtifactCommand): Promise<ProjectArtifactItem> {
    const item = await apiRequest<any>('POST', `/projects/${projectId}/artifacts`, {
      body: {
        name: payload.name,
        url: payload.url,
        type: payload.type || null,
        nodeId: payload.nodeId ? Number(payload.nodeId) : null,
        isInRepository: payload.isInRepository ?? true,
      },
    })
    return this.mapArtifact(item)
  }

  /** DELETE /projects/{projectId}/artifacts/{artifactId} — 404 coi như đã xóa (giữ hành vi cũ). */
  async deleteArtifact(projectId: string, artifactId: string): Promise<void> {
    try {
      await apiRequest<void>('DELETE', `/projects/${projectId}/artifacts/${artifactId}`)
    } catch (error) {
      if (isApiError(error) && error.status === 404) return
      throw error
    }
  }

  // ───────────────────────── Realtime (C) ─────────────────────────

  /** GET /realtime/subscribe?userId= (SSE). EventSource không gửi được header nên vẫn truyền userId qua query. */
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

  // ───────────────────────── Workspace (D) ─────────────────────────

  /** GET /projects */
  async getMyProjects(): Promise<readonly ProjectSummaryDto[]> {
    const data = await apiRequest<any[]>('GET', '/projects')
    const currentUserId = getStoredUserId()
    return (data || []).map((item) => {
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
  }

  async getProjectsList(): Promise<readonly ProjectSummaryDto[]> {
    return this.getMyProjects()
  }

  /** POST /projects */
  async createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto> {
    const item = await apiRequest<any>('POST', '/projects', {
      body: {
        name: cmd.name,
        description: cmd.desc ?? cmd.description ?? '',
        templateId: cmd.templateId ? Number(cmd.templateId) : null,
        visibility: cmd.visibility || 'PRIVATE',
      },
    })
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
  }

  /** POST /projects/clone-template */
  async cloneTemplate(req: CloneTemplateCommand | {
    templateId: string | number
    projectName: string
    description?: string
    visibility?: string
  }): Promise<ProjectDetailDto> {
    const item = await apiRequest<any>('POST', '/projects/clone-template', {
      body: {
        templateId: Number(req.templateId),
        projectName: req.projectName.trim(),
        description: req.description?.trim() || '',
        visibility: req.visibility || 'PRIVATE',
      },
    })
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
  }

  /** PATCH /projects/{id}/status */
  async updateProjectStatus(projectId: string, status: ProjectStatus | string): Promise<ProjectSummaryDto> {
    const item = await apiRequest<any>('PATCH', `/projects/${projectId}/status`, {
      body: { status },
    })
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
  }

  // ───────────────────────── Overview, khách, góp ý (D5) — còn mock ─────────────────────────

  getOverviewData(projectId: string): Promise<OverviewData> {
    return this.mock.getOverviewData(projectId) // D5 (AI: D6)
  }

  resolveFeedback(projectId: string, feedbackId: string): Promise<void> {
    return this.mock.resolveFeedback(projectId, feedbackId) // D5
  }

  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState> {
    return this.mock.toggleGuestAccess(projectId, active) // D5
  }

  generateGuestToken(projectId: string): Promise<GuestAccessState> {
    return this.mock.generateGuestToken(projectId) // D5
  }

  // ───────────────────────── Cài đặt, thành viên (D1/D2) — còn mock ─────────────────────────

  getProjectSettings(projectId: string): Promise<ProjectSettingsDto> {
    return this.mock.getProjectSettings(projectId) // chưa có task
  }

  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto> {
    return this.mock.updateProjectSettings(projectId, cmd) // chưa có task
  }

  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]> {
    return this.mock.getProjectAuditLogs(projectId) // chưa có task
  }

  archiveProject(projectId: string): Promise<ProjectSettingsDto> {
    return this.mock.archiveProject(projectId) // D1
  }

  restoreProject(projectId: string): Promise<ProjectSettingsDto> {
    return this.mock.restoreProject(projectId) // D1
  }

  deleteProject(projectId: string): Promise<void> {
    return this.mock.deleteProject(projectId) // D1
  }

  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]> {
    return this.mock.getProjectMembersDetailed(projectId) // D2
  }

  inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail> {
    return this.mock.inviteProjectMember(projectId, cmd) // D2
  }

  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail> {
    return this.mock.changeMemberRole(projectId, userId, cmd) // D2
  }

  removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }> {
    return this.mock.removeProjectMember(projectId, userId) // D2
  }

  // ───────────────────────── Lời mời (D) ─────────────────────────

  createProjectInvitation(projectId: string, cmd: InviteMemberCommand): Promise<ProjectInvitationDto> {
    return this.mock.createProjectInvitation(projectId, cmd) // D2
  }

  getProjectPendingInvitations(projectId: string): Promise<ProjectInvitationDto[]> {
    return this.mock.getProjectPendingInvitations(projectId) // D2
  }

  revokeInvitation(projectId: string, invitationId: string): Promise<boolean> {
    return this.mock.revokeInvitation(projectId, invitationId) // D2
  }

  /** GET /invitations/{id} — 404 trả null (giữ hành vi cũ). */
  async getInvitationDetail(invitationId: string): Promise<ProjectInvitationDto | null> {
    let data: any
    try {
      data = await apiRequest<any>('GET', `/invitations/${invitationId}`)
    } catch (error) {
      if (isApiError(error) && error.status === 404) return null
      throw error
    }
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
  }

  async getInvitation(invitationId: string): Promise<ProjectInvitationDto | null> {
    return this.getInvitationDetail(invitationId)
  }

  /** POST /invitations/{id}/accept */
  async acceptInvitation(invitationId: string): Promise<{ success: boolean; projectId?: string }> {
    const data = await apiRequest<any>('POST', `/invitations/${invitationId}/accept`)
    return {
      success: true,
      projectId: data?.projectId ? String(data.projectId) : undefined,
    }
  }

  /** POST /invitations/{id}/reject */
  async rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
    await apiRequest<unknown>('POST', `/invitations/${invitationId}/reject`)
    return { success: true }
  }

  // ───────────────────────── Đồ thị và xuất bản (B) ─────────────────────────

  /** GET /projects/{id}/graph → danh sách phase. Dự án chưa có phase thì trả [] (không lấy phase giả). */
  async getMacroPhases(projectId?: string): Promise<MacroPhase[]> {
    const pid = projectId || '1'
    const data = await apiRequest<any>('GET', `/projects/${pid}/graph`)
    const phases: any[] = data?.phases || []
    return phases.map((p: any, idx: number) => ({
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
  }

  /** GET /projects/{id}/graph → cạnh giữa các phase. Không có cạnh thì trả []. */
  async getPhaseEdges(projectId?: string): Promise<[string, string][]> {
    const pid = projectId || '1'
    const data = await apiRequest<any>('GET', `/projects/${pid}/graph`)
    const edges: string[][] = data?.phaseEdges || []
    return edges.map(([from, to]) => [String(from), String(to)])
  }

  /** GET /projects/{id}/graph → cây node của 1 phase. Không tìm thấy phase thì ném ApiError 404. */
  async getPhaseGraph(phaseId: string, projectId?: string): Promise<PhaseTreeData> {
    const pid = projectId || '1'
    const data = await apiRequest<any>('GET', `/projects/${pid}/graph`)
    const phase = (data?.phases || []).find((p: any) => String(p.id) === String(phaseId))
    if (!phase) {
      // Lỗi tính ở phía FE (backend trả 200 nhưng không có phase này): báo lỗi thay vì trả cây giả.
      throw new ApiError({
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: `Không tìm thấy phase ${phaseId} trong dự án ${pid}.`,
      })
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
  }

  /** POST /projects/{id}/phases */
  async createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase> {
    const pid = projectId || dto.projectId || '1'
    const item = await apiRequest<any>('POST', `/projects/${pid}/phases`, {
      body: {
        name: dto.name,
        sub: dto.sub,
        accent: dto.accent,
        parentPhaseId: dto.parentPhaseId ? Number(dto.parentPhaseId) : null,
      },
    })
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
  }

  /** POST /projects/{id}/phases/connect?sourcePhaseId=&targetPhaseId= — 422 chu trình ném ApiError có cycleNodes. */
  async connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    await apiRequest<unknown>('POST', `/projects/${pid}/phases/connect`, {
      query: { sourcePhaseId, targetPhaseId },
    })
  }

  /** POST /projects/{id}/phases/disconnect?sourcePhaseId=&targetPhaseId= */
  async disconnectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    await apiRequest<unknown>('POST', `/projects/${pid}/phases/disconnect`, {
      query: { sourcePhaseId, targetPhaseId },
    })
  }

  /** DELETE /projects/{id}/phases/{phaseId} — 404 coi như đã xóa (giữ hành vi cũ). */
  async deletePhase(phaseId: string, projectId?: string): Promise<void> {
    const pid = projectId || '1'
    try {
      await apiRequest<void>('DELETE', `/projects/${pid}/phases/${phaseId}`)
    } catch (error) {
      if (isApiError(error) && error.status === 404) return
      throw error
    }
  }

  updatePhasePosition(phaseId: string, pos: { x: number; y: number }, projectId?: string): Promise<void> {
    return this.mock.updatePhasePosition(phaseId, pos, projectId) // B5 (sau B2)
  }

  /** POST /projects/{id}/publish — 422 trả kết quả chu trình (giữ hành vi cũ), lỗi khác ném ApiError. */
  async publishPipeline(projectId: string): Promise<PublishPipelineResult> {
    try {
      const data = await apiRequest<any>('POST', `/projects/${projectId}/publish`)
      return {
        success: true,
        newStatus: (data?.status || 'ACTIVE') as any,
      }
    } catch (error) {
      if (isApiError(error) && error.status === 422) {
        return {
          success: false,
          cycleDetected: true,
          violatingNodeIds: error.cycleNodes || [],
        }
      }
      throw error
    }
  }

  // ───────────────────────── Ánh xạ dữ liệu ─────────────────────────

  private mapArtifact(item: any): ProjectArtifactItem {
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
      createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
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
