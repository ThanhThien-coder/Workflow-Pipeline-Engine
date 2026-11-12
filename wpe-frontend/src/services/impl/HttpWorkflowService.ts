import { MockWorkflowService } from '../MockWorkflowService'
import type { CreatePhaseDto, IWorkflowService } from '../contracts/IWorkflowService'
import { apiRequest, API_BASE_URL, getStoredUserId } from '../http/apiClient'
import { ApiError, isApiError } from '../http/ApiError'
import * as authApi from './http/auth'
import * as graphApi from './http/graph'
import * as workspaceApi from './http/workspace'
import * as membersApi from './http/members'
import { ghostIdOf, rootIdOf, toCreatedMacroPhase, toMacroPhases, toPhaseEdges, toPhaseTree } from '../../mappers/graphMapper'
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
  ProjectSummaryDto,
} from '../../types/workspace.types'
import type {
  AuditLogItem,
  ChangeMemberRoleCommand,
  InviteMemberCommand,
  ProjectInvitationDto,
  ProjectMemberDetail,
  ProjectMemberHistoryItem,
  ProjectSettingsDto,
  ProjectStatus,
  PublishPipelineResult,
  UpdateProjectCommand,
} from '../../types/settings.types'
import type { AuthCredentialsDto, AuthResponseDto, RegisterUserCommand, UserDto } from '../../types/auth.types'
import type { GuestAccessState, OverviewData } from '../../types/overview.types'
import type { BackendGraphResponse, GhostDependency, MacroPhase, PhaseNode, PhaseTreeData } from '../../types/workflow.types'
// Kích thước thẻ phase lưu kèm vị trí: đúng kích thước canvas Macro đang vẽ
import { MACRO_CARD_H as MACRO_PHASE_H, MACRO_CARD_W as MACRO_PHASE_W } from '../../utils/macroLayout'

/**
 * A2 — Các phương thức CHƯA có backend (hoặc chưa nối) nên vẫn gọi mock một cách TƯỜNG MINH.
 * Mỗi dòng ghi mã task sẽ chuyển sang API thật. Task nào làm xong thì xóa dòng của mình.
 * Mọi phương thức KHÔNG nằm trong danh sách này đều gọi backend thật và lỗi thì ném ApiError
 * (không còn tự chuyển sang dữ liệu giả).
 */
export const METHODS_STILL_MOCKED = [
  'getOverviewData', // D5 (phần AI: D6)
  'resolveFeedback', // D5
  'toggleGuestAccess', // D5
  'generateGuestToken', // D5
  'getProjectMembers', // C6
  'getProjectSettings', // chưa có task: cần nhóm quyết (gần D1/D2)
  'updateProjectSettings', // chưa có task: cần nhóm quyết (gần D1/D2)
  'getProjectAuditLogs', // chưa có task: cần nhóm quyết
  'deleteProject', // D1
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
  async getMyProjects(params?: workspaceApi.FetchProjectsParams): Promise<readonly ProjectSummaryDto[]> {
    return workspaceApi.fetchProjects(params)
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
    const item = await workspaceApi.setProjectStatus(projectId, status)
    return {
      id: String(item.id),
      name: item.name,
      description: item.description || '',
      status: (item.status || status) as ProjectStatus,
      ownerId: item.ownerId != null ? String(item.ownerId) : undefined,
      ownerName: item.ownerName || '',
      role: 'OWNER',
      nodeCount: item.nodeCount ?? item.totalNodes ?? 0,
      totalNodes: item.totalNodes ?? item.nodeCount ?? 0,
      completedNodes: item.doneNodes ?? item.completedNodes ?? 0,
      inProgressNodes: item.activeNodes ?? item.inProgressNodes ?? 0,
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

  // ───────────────────────── Cài đặt, thành viên (D1/D2) ─────────────────────────

  getProjectSettings(projectId: string): Promise<ProjectSettingsDto> {
    return this.mock.getProjectSettings(projectId) // chưa có task
  }

  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto> {
    return this.mock.updateProjectSettings(projectId, cmd) // chưa có task
  }

  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]> {
    return this.mock.getProjectAuditLogs(projectId) // chưa có task
  }

  async archiveProject(projectId: string): Promise<ProjectSettingsDto> {
    const item = await workspaceApi.setProjectStatus(projectId, 'ARCHIVED')
    return {
      id: String(item.id),
      name: item.name,
      description: item.description || '',
      status: (item.status || 'ARCHIVED') as ProjectStatus,
      ownerId: item.ownerId != null ? String(item.ownerId) : '',
      myRole: 'OWNER',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }
  }

  async restoreProject(projectId: string): Promise<ProjectSettingsDto> {
    const item = await workspaceApi.setProjectStatus(projectId, 'ACTIVE')
    return {
      id: String(item.id),
      name: item.name,
      description: item.description || '',
      status: (item.status || 'ACTIVE') as ProjectStatus,
      ownerId: item.ownerId != null ? String(item.ownerId) : '',
      myRole: 'OWNER',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }
  }

  deleteProject(projectId: string): Promise<void> {
    return this.mock.deleteProject(projectId) // D1
  }

  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]> {
    return membersApi.listMembers(projectId)
  }

  getProjectMemberHistory(projectId: string): Promise<ProjectMemberHistoryItem[]> {
    return membersApi.listMemberHistory(projectId)
  }

  async inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail> {
    const inv = await membersApi.createInvitation(projectId, cmd)
    return {
      userId: inv.inviteeId || `inv-${inv.id}`,
      username: inv.inviteeEmail.split('@')[0],
      email: inv.inviteeEmail,
      role: inv.role,
      joinedAt: inv.createdAt,
      activeNodeCount: 0,
      avatarClass: membersApi.getStableAvatarClass(inv.inviteeId || inv.id),
      initials: (inv.inviteeEmail[0] || 'U').toUpperCase(),
    }
  }

  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail> {
    return membersApi.changeRole(projectId, userId, cmd.role)
  }

  async removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }> {
    const res = await membersApi.removeMember(projectId, userId)
    return { unassignedTaskCount: res.unassignedTaskCount }
  }

  // ───────────────────────── Lời mời (D) ─────────────────────────

  createProjectInvitation(projectId: string, cmd: InviteMemberCommand): Promise<ProjectInvitationDto> {
    return membersApi.createInvitation(projectId, cmd)
  }

  getProjectPendingInvitations(projectId: string): Promise<ProjectInvitationDto[]> {
    return membersApi.listPendingInvitations(projectId)
  }

  revokeInvitation(projectId: string, invitationId: string): Promise<boolean> {
    return membersApi.revokeInvitation(projectId, invitationId)
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

  // ───────────────────────── Đồ thị và xuất bản (B5) — gọi qua impl/http/graph.ts ─────────────────────────
  // Đổi dữ liệu phẳng của backend sang MacroPhase / GraphNodeMap: mappers/graphMapper.ts.

  /**
   * Ghi nhớ từ lần đọc đồ thị gần nhất: phase thuộc dự án nào, tên gì; node tên gì, ở phase nào.
   * Cần vì contract chỉ truyền phaseId cho addRootTask/attachGhostNode, và PUT /phases bắt buộc có name.
   */
  private readonly phaseIndex = new Map<string, { projectId: string; name: string }>()
  private readonly nodeIndex = new Map<string, { title: string; phaseId: string | null; status: string | null }>()
  private readonly schedulePhaseSave = graphApi.createKeyedDebounce(graphApi.PHASE_POSITION_DEBOUNCE_MS)

  private async loadGraph(projectId: string): Promise<BackendGraphResponse> {
    const graph = await graphApi.fetchGraph(projectId)
    for (const p of graph?.phases || []) {
      this.phaseIndex.set(String(p.id), { projectId, name: p.name })
    }
    for (const n of graph?.nodes || []) {
      this.nodeIndex.set(String(n.id), {
        title: n.title,
        phaseId: n.phaseId != null ? String(n.phaseId) : null,
        status: n.status ?? null,
      })
    }
    return graph
  }

  private projectIdOfPhase(phaseId: string): string {
    const known = this.phaseIndex.get(String(phaseId))
    if (!known) {
      throw new ApiError({
        status: 400,
        code: 'PHASE_NOT_LOADED',
        message: `Chưa tải đồ thị chứa phase ${phaseId}. Tải lại trang rồi thử lại.`,
      })
    }
    return known.projectId
  }

  /** GET /projects/{id}/graph → danh sách phase. Dự án chưa có phase thì trả [] (không lấy phase giả). */
  async getMacroPhases(projectId?: string): Promise<MacroPhase[]> {
    return toMacroPhases(await this.loadGraph(projectId || '1'))
  }

  /** GET /projects/{id}/graph → cạnh giữa các phase. Không có cạnh thì trả []. */
  async getPhaseEdges(projectId?: string): Promise<[string, string][]> {
    return toPhaseEdges(await this.loadGraph(projectId || '1'))
  }

  /** GET /projects/{id}/graph → cây node của 1 phase. Không tìm thấy phase thì ném ApiError 404. */
  async getPhaseGraph(phaseId: string, projectId?: string): Promise<PhaseTreeData> {
    const pid = projectId || '1'
    const tree = toPhaseTree(await this.loadGraph(pid), phaseId)
    if (!tree) {
      // Backend trả 200 nhưng không có phase này: báo lỗi thay vì trả cây giả.
      throw new ApiError({
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: `Không tìm thấy phase ${phaseId} trong dự án ${pid}.`,
      })
    }
    return tree
  }

  /** POST /projects/{id}/phases */
  async createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase> {
    const pid = projectId || dto.projectId || '1'
    const item = await graphApi.createPhase(pid, {
      name: dto.name,
      sub: dto.sub,
      accent: dto.accent,
      parentPhaseId: dto.parentPhaseId ? Number(dto.parentPhaseId) : null,
    })
    this.phaseIndex.set(String(item.id), { projectId: pid, name: item.name })
    return toCreatedMacroPhase(item, { x: dto.x, y: dto.y })
  }

  /** POST /projects/{id}/phases/connect?sourcePhaseId=&targetPhaseId= — 422 chu trình ném ApiError có cycleNodes. */
  async connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    await graphApi.connectPhases(projectId || '1', sourcePhaseId, targetPhaseId)
  }

  /** POST /projects/{id}/phases/disconnect?sourcePhaseId=&targetPhaseId= */
  async disconnectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    await graphApi.disconnectPhases(projectId || '1', sourcePhaseId, targetPhaseId)
  }

  /** DELETE /projects/{id}/phases/{phaseId} — 404 coi như đã xóa (giữ hành vi cũ). */
  async deletePhase(phaseId: string, projectId?: string): Promise<void> {
    try {
      await graphApi.deletePhase(projectId || '1', phaseId)
      this.phaseIndex.delete(String(phaseId))
    } catch (error) {
      if (isApiError(error) && error.status === 404) return
      throw error
    }
  }

  /**
   * PUT /projects/{id}/phases/{phaseId} với uiMetadata {x, y, w, h} (B2, V9).
   * Debounce 300ms theo từng phase: kéo nhiều lần liên tiếp chỉ gửi vị trí cuối cùng.
   */
  updatePhasePosition(phaseId: string, pos: { x: number; y: number }, projectId?: string): Promise<void> {
    const id = String(phaseId)
    return this.schedulePhaseSave(id, async () => {
      const pid = projectId || this.phaseIndex.get(id)?.projectId || '1'
      if (!this.phaseIndex.has(id)) await this.loadGraph(pid)
      const name = this.phaseIndex.get(id)?.name
      if (!name) {
        throw new ApiError({ status: 404, code: 'RESOURCE_NOT_FOUND', message: `Không tìm thấy phase ${id} trong dự án ${pid}.` })
      }
      await graphApi.updatePhase(pid, id, {
        name,
        uiMetadata: { x: Math.round(pos.x), y: Math.round(pos.y), w: MACRO_PHASE_W, h: MACRO_PHASE_H },
      })
    })
  }

  /** POST /projects/{id}/nodes — thêm 1 node vào phase (backend tạo ở trạng thái LOCKED). */
  async addRootTask(phaseId: string, payload: { title: string }): Promise<PhaseNode> {
    const pid = this.projectIdOfPhase(phaseId)
    const created = await graphApi.createNode(pid, {
      phaseId: graphApi.toBackendId(String(phaseId), 'Phase'),
      title: payload.title.trim(),
    })
    this.nodeIndex.set(String(created.id), { title: created.title, phaseId: String(phaseId), status: created.status ?? null })
    return {
      id: String(created.id),
      title: created.title,
      status: ((created.status as TaskStatus) || 'LOCKED'),
      parentId: rootIdOf(String(phaseId)),
    }
  }

  /**
   * POST /projects/{id}/dependencies — node nguồn (sourceTaskId) là cha, node đích (targetTaskId) là con.
   * Dùng cho cả ghost (nguồn ở phase khác) lẫn nối 2 node cùng phase. Tạo vòng thì ApiError 422 có cycleNodes.
   */
  async attachGhostNode(
    phaseId: string,
    payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }
  ): Promise<GhostDependency> {
    const pid = this.projectIdOfPhase(phaseId)
    const parentId = graphApi.toBackendId(payload.sourceTaskId, 'Node nguồn')
    const childId = graphApi.toBackendId(payload.targetTaskId, 'Node đích')
    await graphApi.createDependency(pid, parentId, childId)

    const source = this.nodeIndex.get(payload.sourceTaskId)
    return {
      id: ghostIdOf(payload.sourceTaskId, payload.targetTaskId),
      sourcePhaseId: payload.sourcePhaseId,
      sourcePhaseTitle: this.phaseIndex.get(payload.sourcePhaseId)?.name || payload.sourcePhaseId,
      sourceTaskId: payload.sourceTaskId,
      sourceTaskTitle: source?.title || payload.sourceTaskId,
      targetTaskId: payload.targetTaskId,
      status: source?.status === 'DONE' ? 'DONE' : 'LOCKED',
    }
  }

  // resetPhaseTree: chưa có trong SSOT (integration map Cụm 4) nên HttpWorkflowService không cài.
  // Nút "Reset Phase Tree" trên canvas gọi store.resetPhaseTree, tức là chỉ đọc lại đồ thị từ backend (GET), không xóa gì.

  /** POST /projects/{id}/publish — 422 trả kết quả chu trình (giữ hành vi cũ), lỗi khác ném ApiError. */
  async publishPipeline(projectId: string): Promise<PublishPipelineResult> {
    try {
      const data = await graphApi.publishProject(projectId)
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
