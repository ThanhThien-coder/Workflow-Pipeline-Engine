import type { MacroPhase, PhaseTreeData } from '../../types/workflow.types'
import type { GuestAccessState, OverviewData } from '../../types/overview.types'
import type { ArtifactItem, KanbanTask, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import type {
  ProjectSettingsDto,
  ProjectMemberDetail,
  AuditLogItem,
  UpdateProjectCommand,
  InviteMemberCommand,
  ChangeMemberRoleCommand,
  PublishPipelineResult,
  ProjectStatus,
} from '../../types/settings.types'

export type { MacroPhase } from '../../types/workflow.types'

export interface CreatePhaseDto {
  name: string
  sub?: string
  accent?: 'emerald' | 'blue' | 'slate'
  parentPhaseId?: string
  x?: number
  y?: number
}

export interface IWorkflowService {
  getMacroPhases(): Promise<MacroPhase[]>
  getPhaseEdges(): Promise<[string, string][]>
  getPhaseGraph(phaseId: string): Promise<PhaseTreeData>
  createPhase(dto: CreatePhaseDto): Promise<MacroPhase>
  connectPhases(sourcePhaseId: string, targetPhaseId: string): Promise<void>
  deletePhase(phaseId: string): Promise<void>
  getOverviewData(projectId: string): Promise<OverviewData>
  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState>
  generateGuestToken(projectId: string): Promise<GuestAccessState>
  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]>
  updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<KanbanTask>
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }>
  getProjectMembers(projectId: string): Promise<UserSummary[]>

  /* Project Governance & Settings */
  getProjectSettings(projectId: string): Promise<ProjectSettingsDto>
  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto>
  publishPipeline(projectId: string, simulateCycle?: boolean): Promise<PublishPipelineResult>
  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]>
  inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail>
  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail>
  removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }>
  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]>

  /* Dev & Simulation capabilities (Optional, for mock/staging) */
  resetMockData?(): Promise<void>
  setMockLatency?(ms: number): void
  setMockError?(hasError: boolean): void
  setProjectStatus?(projectId: string, status: ProjectStatus): Promise<void>
}
