import type { MacroPhase, PhaseTreeData, PhaseNode, GhostDependency, BranchGraphNode } from '../../types/workflow.types'
import type { AiDiagnosticReport, GuestAccessState, OverviewData } from '../../types/overview.types'
import type { GuestReportDto } from '../../types/guest.types'
import type { ArtifactItem, KanbanTask, ReopenImpact, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import type {
  ProjectSettingsDto,
  ProjectMemberDetail,
  ProjectMemberHistoryItem,
  ProjectInvitationDto,
  AuditLogItem,
  UpdateProjectCommand,
  InviteMemberCommand,
  ChangeMemberRoleCommand,
  PublishPipelineResult,
  ProjectStatus,
} from '../../types/settings.types'
import type {
  AuthCredentialsDto,
  AuthResponseDto,
  RegisterUserCommand,
  UserDto,
} from '../../types/auth.types'
import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  ProjectDetailDto,
  ProjectSummaryDto,
} from '../../types/workspace.types'

import type { ArtifactItem as ProjectArtifactItem, CreateArtifactCommand, UpdateArtifactCommand } from '../../types/artifact.types'

export type { MacroPhase } from '../../types/workflow.types'

export interface CreatePhaseDto {
  name: string
  sub?: string
  accent?: 'emerald' | 'blue' | 'slate'
  parentPhaseId?: string
  projectId?: string
  x?: number
  y?: number
}

/** Thông tin task sửa được trong hộp chi tiết. Gửi đủ trạng thái mong muốn: null là bỏ người làm / hạn chót. */
export interface TaskNodePatch {
  title: string
  description: string
  joinPolicy: 'ALL_COMPLETED' | 'ANY_COMPLETED'
  assigneeId: string | null
  /** YYYY-MM-DD */
  dueDate: string | null
}

export interface IWorkflowService {
  // Auth contracts
  login(credentials: AuthCredentialsDto): Promise<AuthResponseDto>
  register(cmd: RegisterUserCommand): Promise<AuthResponseDto>
  getCurrentUser(): Promise<UserDto>
  logout(): Promise<void>

  // Workspace contracts
  getMyProjects(params?: { tab?: 'all' | 'mine' | 'shared' | 'archived'; sort?: 'ts' | 'done' | 'nodes' }): Promise<readonly ProjectSummaryDto[]>
  getProjectsList(): Promise<readonly ProjectSummaryDto[]>
  createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto>
  cloneTemplate(req: CloneTemplateCommand | { templateId: string | number; projectName: string; description?: string; visibility?: string }): Promise<ProjectDetailDto>
  updateProjectStatus?(projectId: string, status: ProjectStatus | string): Promise<ProjectSummaryDto>

  getMacroPhases(projectId?: string): Promise<MacroPhase[]>
  getPhaseEdges(projectId?: string): Promise<[string, string][]>
  getPhaseGraph(phaseId: string, projectId?: string): Promise<PhaseTreeData>
  /** `node` (nếu có) là thẻ đầy đủ để chèn vào cây ngay; thiếu thì store đọc lại cây. */
  addRootTask?(phaseId: string, payload: { title: string }): Promise<PhaseNode & { node?: BranchGraphNode }>
  attachGhostNode?(phaseId: string, payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }): Promise<GhostDependency>
  /** Chế độ API: tạo task trong phase rồi nối từ các task cha (1 cha = subtask, nhiều cha = task hội tụ). */
  addChildTask?(phaseId: string, parentTaskIds: string[], payload: { title: string }): Promise<PhaseNode & { node?: BranchGraphNode }>
  /** Chế độ API: sửa thông tin task (không sửa trạng thái). */
  updateTaskNode?(taskId: string, patch: TaskNodePatch): Promise<void>
  /** Chế độ API: xóa task (backend chỉ cho xóa task LOCKED hoặc TODO). */
  deleteTaskNode?(taskId: string): Promise<void>
  /** Chế độ API: chủ dự án mở khóa sớm task đang LOCKED (LOCKED → TODO dù task trước chưa xong). */
  forceUnlockTask?(taskId: string): Promise<void>
  /** Chế độ API: một lần GET /graph trả phase, cạnh và cây của mọi phase. */
  getProjectGraph?(projectId: string): Promise<{ phases: MacroPhase[]; edges: [string, string][]; trees: Record<string, PhaseTreeData> }>
  /** Chế độ API: đổi tên phase (PUT chỉ gửi name, backend giữ vị trí). */
  renamePhase?(phaseId: string, name: string, projectId?: string): Promise<void>
  /** Chế độ API: gỡ cạnh phụ thuộc giữa 2 task (DELETE /dependencies). */
  deleteDependency?(phaseId: string, parentTaskId: string, childTaskId: string): Promise<void>
  resetPhaseTree?(phaseId: string): Promise<void>
  createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase>
  connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void>
  disconnectPhases?(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void>
  deletePhase(phaseId: string, projectId?: string): Promise<void>
  updatePhasePosition?(phaseId: string, pos: { x: number; y: number }, projectId?: string): Promise<void>
  getOverviewData(projectId: string): Promise<OverviewData>
  /** Report dự án cho thành viên (GET /projects/{id}/report), cùng dạng report của trang khách. Chế độ mock không có. */
  getProjectReport?(projectId: string): Promise<GuestReportDto>
  resolveFeedback(projectId: string, feedbackId: string): Promise<void>
  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState>
  generateGuestToken(projectId: string): Promise<GuestAccessState>
  /** Chạy chẩn đoán AI mới cho dự án (nút Re-scan). Lỗi 429/403 ném ra cho store xử lý. */
  runAiDiagnosis(projectId: string): Promise<AiDiagnosticReport>
  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]>
  /** Mọi task của một phase cho Kanban theo phase (kể cả LOCKED, chưa giao). */
  getPhaseTasks(projectId: string, phaseId: string): Promise<KanbanTask[]>
  /** G18: hàng chờ duyệt: mọi task REVIEW của dự án (chỉ chủ dự án / quản lý gọi được). */
  getReviewTasks(projectId: string): Promise<KanbanTask[]>
  updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask>
  /** S04 (chế độ API): mở lại task Done (chỉ chủ dự án / quản lý, bắt buộc lý do). */
  reopenTask?(taskId: string, reason: string): Promise<KanbanTask>
  /** S04 (chế độ API): xem trước task con nào bị ảnh hưởng khi mở lại task Done. */
  getReopenImpact?(taskId: string): Promise<ReopenImpact>
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }>
  updateTaskAssignment(taskId: string, cmd: { assignedUserId?: string; dueDate?: string; version: number }): Promise<Pick<KanbanTask, 'assignedUserId' | 'dueDate' | 'version'>>
  getProjectMembers(projectId: string): Promise<UserSummary[]>

  /* Artifacts Hub (Repository & Deliverables) */
  getProjectArtifacts(projectId: string): Promise<ProjectArtifactItem[]>
  createArtifact(projectId: string, payload: CreateArtifactCommand): Promise<ProjectArtifactItem>
  /** PUT /projects/{projectId}/artifacts/{artifactId}: sửa tên và link. */
  updateArtifact(projectId: string, artifactId: string, payload: UpdateArtifactCommand): Promise<ProjectArtifactItem>
  deleteArtifact(projectId: string, artifactId: string): Promise<void>
  setArtifactGuestVisibility(projectId: string, artifactId: string, visible: boolean): Promise<ProjectArtifactItem | void>

  /* Project Governance & Settings */
  getProjectSettings(projectId: string): Promise<ProjectSettingsDto>
  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto>
  publishPipeline(projectId: string): Promise<PublishPipelineResult>
  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]>
  getProjectMemberHistory(projectId: string): Promise<ProjectMemberHistoryItem[]>
  inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail>
  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail>
  removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }>
  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]>
  archiveProject(projectId: string): Promise<ProjectSettingsDto>
  restoreProject(projectId: string): Promise<ProjectSettingsDto>
  deleteProject(projectId: string): Promise<void>

  /* Project Invitations (Asynchronous Lifecycle) */
  createProjectInvitation?(projectId: string, cmd: InviteMemberCommand): Promise<ProjectInvitationDto>
  getProjectPendingInvitations?(projectId: string): Promise<ProjectInvitationDto[]>
  getInvitationDetail?(invitationId: string): Promise<ProjectInvitationDto | null>
  getInvitation?(invitationId: string): Promise<ProjectInvitationDto | null>
  acceptInvitation?(invitationId: string): Promise<{ success: boolean; projectId?: string }>
  rejectInvitation?(invitationId: string): Promise<{ success: boolean }>
  revokeInvitation?(projectId: string, invitationId: string): Promise<boolean>

  /* Dev & Simulation capabilities (Optional, for mock/staging) */
  resetMockData?(): Promise<void>
  setMockLatency?(ms: number): void
  setMockError?(hasError: boolean): void
  setMockCycleError?(simulate: boolean): void
  setProjectStatus?(projectId: string, status: ProjectStatus): Promise<void>
}
