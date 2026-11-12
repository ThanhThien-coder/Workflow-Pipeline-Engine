import type { MacroPhase, PhaseTreeData, PhaseNode, GhostDependency } from '../../types/workflow.types'
import type { GuestAccessState, OverviewData } from '../../types/overview.types'
import type { ArtifactItem, KanbanTask, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
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

import type { ArtifactItem as ProjectArtifactItem, CreateArtifactCommand } from '../../types/artifact.types'

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
  addRootTask?(phaseId: string, payload: { title: string }): Promise<PhaseNode>
  attachGhostNode?(phaseId: string, payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }): Promise<GhostDependency>
  resetPhaseTree?(phaseId: string): Promise<void>
  createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase>
  connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void>
  disconnectPhases?(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void>
  deletePhase(phaseId: string, projectId?: string): Promise<void>
  updatePhasePosition?(phaseId: string, pos: { x: number; y: number }, projectId?: string): Promise<void>
  getOverviewData(projectId: string): Promise<OverviewData>
  resolveFeedback(projectId: string, feedbackId: string): Promise<void>
  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState>
  generateGuestToken(projectId: string): Promise<GuestAccessState>
  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]>
  updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask>
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }>
  updateTaskAssignment(taskId: string, cmd: { assignedUserId?: string; dueDate?: string; version: number }): Promise<Pick<KanbanTask, 'assignedUserId' | 'dueDate' | 'version'>>
  getProjectMembers(projectId: string): Promise<UserSummary[]>

  /* Artifacts Hub (Repository & Deliverables) */
  getProjectArtifacts(projectId: string): Promise<ProjectArtifactItem[]>
  createArtifact(projectId: string, payload: CreateArtifactCommand): Promise<ProjectArtifactItem>
  deleteArtifact(projectId: string, artifactId: string): Promise<void>

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
