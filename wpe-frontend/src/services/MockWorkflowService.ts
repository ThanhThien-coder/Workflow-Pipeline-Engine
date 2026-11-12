import type { GraphNode, GraphNodeMap, MacroPhase, NodeStatus, PhaseTree } from '../types/workflow.types'
import type { CreatePhaseDto, IWorkflowService } from './contracts/IWorkflowService'
import { isPhaseAncestor } from '../utils/spanningTreeLayout'
import { computeSmartMacroPhasePosition } from '../utils/macroLayout'
import { MockOverviewApi } from './mock/MockWorkflowService.overview'
import { guestAccessStore } from './mock/guestAccessStore'
import type { GuestAccessState, OverviewData } from '../types/overview.types'
import type { ArtifactItem, KanbanTask, SubmitArtifactDto, TaskStatus, UserSummary } from '../types/kanban.types'
import { MockTaskApi } from './mock/MockWorkflowService.tasks'
import { MockSettingsApi } from './mock/MockWorkflowService.settings'
import { MockAuthApi } from './mock/MockWorkflowService.auth'
import { MockWorkspaceApi } from './mock/MockWorkflowService.workspace'
import { MockConfig } from './mock/MockConfig'
import {
  getStoredProjectGraph,
  saveStoredProjectGraph,
  cloneTemplateToProject,
  addPhaseToProject,
  connectPhasesInProject,
  disconnectPhasesInProject,
  deletePhaseInProject,
  updatePhasePositionInProject,
} from './mock/mockProjectGraphStore'
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
} from '../types/settings.types'
import type {
  AuthCredentialsDto,
  AuthResponseDto,
  RegisterUserCommand,
  UserDto,
} from '../types/auth.types'
import type {
  CloneTemplateCommand,
  CreateProjectCommand,
  ProjectDetailDto,
  ProjectSummaryDto,
} from '../types/workspace.types'
import {
  type ArtifactItem as ProjectArtifactItem,
  type CreateArtifactCommand,
  INITIAL_PROJECT_ARTIFACTS,
} from '../types/artifact.types'

export const PHASES: MacroPhase[] = [
  { id: 'p1', name: 'PHASE 1', sub: 'Nền tảng (Foundation)', status: 'COMPLETED', pct: 100, accent: 'emerald', x: 20, y: 140, w: 250, h: 220, parentPhaseIds: [] },
  { id: 'p2a', name: 'PHASE 2A', sub: 'Cụm Xác thực (Auth)', status: 'IN_PROGRESS', pct: 70, accent: 'blue', x: 360, y: 40, w: 440, h: 170, parentPhaseIds: ['p1'] },
  { id: 'p2b', name: 'PHASE 2B', sub: 'Cụm Giỏ hàng (Cart)', status: 'TODO', pct: 0, accent: 'slate', x: 360, y: 290, w: 440, h: 170, parentPhaseIds: ['p1'] },
  { id: 'p3', name: 'PHASE 3', sub: 'Tích hợp Toàn hệ thống', status: 'LOCKED', pct: 0, accent: 'slate', x: 890, y: 140, w: 250, h: 220, parentPhaseIds: ['p2a', 'p2b'], locked: true },
]

let codeSequence = 0

function node(value: Partial<Extract<GraphNode, { kind: 'branch' }>> & Pick<Extract<GraphNode, { kind: 'branch' }>, 'id' | 'title'>): Extract<GraphNode, { kind: 'branch' }> {
  codeSequence += 1
  return {
    kind: 'branch',
    code: `WPE-${String(codeSequence).padStart(3, '0')}`,
    description: '',
    isTrack: false,
    progress: undefined,
    assignee: null,
    due: null,
    blocker: 'Không có',
    joinPolicy: null,
    parentIds: [],
    status: 'TODO',
    ...value,
  }
}

export function ghostNode(id: string, parentIds: string[], refPhase: string, refId: string, dir: 'up' | 'down'): Extract<GraphNode, { kind: 'ghost' }> {
  return { id, kind: 'ghost', parentIds, refPhase, refId, dir, title: '' }
}

export function seedP2A(): GraphNodeMap {
  const nodes: GraphNodeMap = {}
  const put = (value: GraphNode) => { nodes[value.id] = value }
  put({ id: 'root', kind: 'root', parentIds: [], title: 'Phase 2A: Auth Module' })
  put(node({ id: 'trk_db', isTrack: true, trackId: 'trk_db', title: 'Track 1: Cơ sở dữ liệu', status: 'DONE', parentIds: ['root'], order: 0, level: 1, column: 1 }))
  put(node({ id: 't_db', trackId: 'trk_db', title: 'Thiết kế Session Schema', status: 'DONE', assignee: 'Sarah Chen', due: '2026-09-20', parentIds: ['trk_db'], order: 0, level: 2, column: 2 }))
  put(node({ id: 'trk_api', isTrack: true, trackId: 'trk_api', title: 'Track 2: API Services', status: 'IN_PROGRESS', parentIds: ['root'], order: 1, level: 1, column: 1 }))
  put(node({ id: 't_login', trackId: 'trk_api', title: 'POST /login API', status: 'DONE', assignee: 'Alex Kim', due: '2026-09-18', parentIds: ['trk_api'], order: 0, level: 2, column: 2 }))
  put(node({ id: 't_register', trackId: 'trk_api', title: 'POST /register API', status: 'IN_PROGRESS', progress: 80, assignee: 'Marcus Liu', due: '2026-09-29', blocker: 'Chờ review schema xác thực email', parentIds: ['trk_api'], order: 1, level: 2, column: 2 }))
  put(node({ id: 't_jwt', trackId: 'trk_api', title: 'JWT Refresh Token flow', status: 'TODO', assignee: 'Marcus Liu', due: '2026-10-05', blocker: 'Chờ /register API hoàn tất', parentIds: ['trk_api'], order: 2, level: 2, column: 2 }))
  put(node({ id: 'trk_ui', isTrack: true, trackId: 'trk_ui', title: 'Track 3: Giao diện Form UI', status: 'IN_PROGRESS', parentIds: ['root'], order: 2, level: 1, column: 1 }))
  put(node({ id: 't_loginform', trackId: 'trk_ui', title: 'Login Form Component', status: 'IN_PROGRESS', progress: 60, assignee: 'Jamie Doe', due: '2026-09-27', parentIds: ['trk_ui'], order: 0, level: 2, column: 2 }))
  put(node({ id: 't_oauth', trackId: 'trk_ui', title: 'OAuth Google Button', status: 'TODO', assignee: 'Jamie Doe', due: '2026-10-03', blocker: 'Chờ Login Form xong', parentIds: ['trk_ui'], order: 1, level: 2, column: 2 }))
  put(node({ id: 'trk_e2e', isTrack: true, trackId: 'trk_e2e', title: 'Track 4: Kiểm thử E2E', status: 'LOCKED', parentIds: ['root'], order: 3, level: 1, column: 1 }))
  put(node({ id: 't_e2e', trackId: 'trk_e2e', title: 'Test Tích hợp E2E', status: 'LOCKED', blocker: 'Chờ JWT flow & Login Form đều DONE', parentIds: ['trk_e2e', 't_jwt', 't_loginform'], joinPolicy: 'AND', order: 0, level: 2, column: 2 }))
  put(ghostNode('g_p1', ['root'], 'p1', 'x1', 'up'))
  const sessionSchema = nodes.t_db
  if (sessionSchema?.kind === 'branch') nodes.t_db = { ...sessionSchema, parentIds: ['trk_db', 'g_p1'], joinPolicy: 'AND' }
  put(ghostNode('g_p3', ['t_e2e'], 'p3', 'x1', 'down'))
  return nodes
}

export function seedSimple(title: string, breadcrumb: string, pct: number, gate: PhaseTree['gate'], trackTitle: string, trackStatus: NodeStatus, taskTitle: string, taskStatus: NodeStatus, assignee: string, due: string, blocker: string): PhaseTree {
  const nodes: GraphNodeMap = {}
  const put = (value: GraphNode) => { nodes[value.id] = value }
  put({ id: 'root', kind: 'root', parentIds: [], title })
  put(node({ id: 'trk1', isTrack: true, trackId: 'trk1', title: trackTitle, status: trackStatus, parentIds: ['root'] }))
  put(node({ id: 'x1', trackId: 'trk1', title: taskTitle, status: taskStatus, assignee, due, blocker, parentIds: ['trk1'] }))
  return { title, breadcrumb, pct, gate, nodes }
}

export const TREES: Record<string, PhaseTree> = {
  p2a: { title: 'Phase 2A: Auth Module', breadcrumb: 'Dự án Marketing Q4 › Phase 2A · Cụm Xác thực (Auth Group)', pct: 70, gate: { prLink: '#142', prMerged: true, swagger: '' }, nodes: seedP2A() },
  p1: seedSimple('Phase 1: Foundation', 'Dự án Marketing Q4 › Phase 1 · Nền tảng', 100, { prLink: '#128', prMerged: true, swagger: '' }, 'Track: Kiến trúc & DB', 'DONE', 'Core DB Schema', 'DONE', 'Sarah Chen', '2026-09-14', 'Không có'),
  p2b: seedSimple('Phase 2B: Cart Module', 'Dự án Marketing Q4 › Phase 2B · Cụm Giỏ hàng', 0, { prLink: null, prMerged: false, swagger: '' }, 'Track: Giỏ hàng', 'TODO', 'Thiết kế Cart Schema', 'TODO', 'Alex Kim', '2026-10-10', 'Chờ Phase 1 bàn giao'),
  p3: seedSimple('Phase 3: Tích hợp Toàn hệ thống', 'Dự án Marketing Q4 › Phase 3 · Tích hợp', 0, { prLink: null, prMerged: false, swagger: '' }, 'Track: Tích hợp', 'LOCKED', 'Test Tích hợp Toàn hệ thống', 'LOCKED', 'Marcus Liu', '2026-10-25', 'Chờ Phase 2A & 2B'),
}
TREES.p2b.nodes.x2 = node({ id: 'x2', title: 'Thiết kế Payment Flow', status: 'TODO', assignee: 'Marcus Liu', due: '2026-10-14', parentIds: ['trk1'] })

export class MockWorkflowService implements IWorkflowService {
  private phases = PHASES.map((phase) => ({ ...phase }))
  private readonly overviewApi = new MockOverviewApi()
  private readonly taskApi = new MockTaskApi()
  private readonly settingsApi = new MockSettingsApi()
  private readonly authApi = new MockAuthApi()
  private readonly workspaceApi = new MockWorkspaceApi()
  private lastGuestToken: string | null = null

  // Auth contracts
  login(credentials: AuthCredentialsDto): Promise<AuthResponseDto> {
    return this.authApi.login(credentials)
  }

  register(cmd: RegisterUserCommand): Promise<AuthResponseDto> {
    return this.authApi.register(cmd)
  }

  getCurrentUser(): Promise<UserDto> {
    return this.authApi.getCurrentUser()
  }

  logout(): Promise<void> {
    return this.authApi.logout()
  }

  // Workspace contracts
  getMyProjects(params?: { tab?: 'all' | 'mine' | 'shared' | 'archived'; sort?: 'ts' | 'done' | 'nodes' }): Promise<readonly ProjectSummaryDto[]> {
    return this.workspaceApi.getMyProjects(params)
  }

  getProjectsList(): Promise<readonly ProjectSummaryDto[]> {
    return this.workspaceApi.getProjectsList()
  }

  createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto> {
    return this.workspaceApi.createProject(cmd)
  }

  cloneTemplate(req: CloneTemplateCommand | { templateId: string | number; projectName: string; description?: string; visibility?: string }): Promise<ProjectDetailDto> {
    return this.workspaceApi.cloneTemplate({
      templateId: req.templateId,
      projectName: req.projectName,
      description: req.description,
      visibility: req.visibility,
    })
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus | string): Promise<ProjectSummaryDto> {
    this.workspaceApi.updateProjectStatus(projectId, status as ProjectStatus)
    this.settingsApi.setProjectStatus(status as ProjectStatus)
    this.overviewApi.setProjectStatus(status as ProjectStatus)
    const list = await this.getProjectsList()
    const found = list.find((p) => String(p.id) === String(projectId))
    if (found) return found
    return {
      id: String(projectId),
      name: 'Project',
      description: '',
      status: status as ProjectStatus,
      role: 'OWNER',
      nodeCount: 0,
      criticalPathLength: 0,
      completionPercent: 0,
      updatedAt: new Date().toISOString(),
      members: [],
    }
  }

  async getMacroPhases(projectId?: string): Promise<MacroPhase[]> {
    if (projectId && projectId !== '1') {
      const customGraph = getStoredProjectGraph(projectId)
      if (customGraph) {
        return customGraph.phases.map((phase) => ({ ...phase }))
      }
    }
    return this.phases.map((phase) => ({ ...phase }))
  }

  async getPhaseEdges(projectId?: string): Promise<[string, string][]> {
    if (projectId && projectId !== '1') {
      const customGraph = getStoredProjectGraph(projectId)
      if (customGraph) {
        return customGraph.phases.flatMap((phase) =>
          phase.parentPhaseIds.map((parent) => [parent, phase.id] as [string, string])
        )
      }
    }
    return this.phases.flatMap((phase) =>
      phase.parentPhaseIds.map((parent) => [parent, phase.id] as [string, string])
    )
  }

  async getPhaseGraph(phaseId: string, projectId?: string): Promise<GraphNodeMap> {
    if (projectId && projectId !== '1') {
      const customGraph = getStoredProjectGraph(projectId)
      if (customGraph && customGraph.trees[phaseId]) {
        const tree = customGraph.trees[phaseId]
        return Object.fromEntries(
          Object.entries(tree.nodes).map(([id, graphNode]) => [
            id,
            { ...graphNode, parentIds: [...graphNode.parentIds] },
          ])
        )
      }
    }
    if (phaseId === 'p2a') {
      return seedP2A()
    }
    const tree = TREES[phaseId]
    if (!tree) throw new Error(`Unknown phase: ${phaseId}`)
    return Object.fromEntries(
      Object.entries(tree.nodes).map(([id, graphNode]) => [
        id,
        { ...graphNode, parentIds: [...graphNode.parentIds] },
      ])
    )
  }

  async getOverviewData(projectId: string): Promise<OverviewData> {
    const data = await this.overviewApi.getOverviewData(projectId)
    if (data?.guestAccess) {
      guestAccessStore.set(data.guestAccess.token, data.guestAccess.isActive ? 'active' : 'revoked')
      this.lastGuestToken = data.guestAccess.token
    }
    return data
  }

  resolveFeedback(projectId: string, feedbackId: string): Promise<void> {
    return this.overviewApi.resolveFeedback(projectId, feedbackId)
  }

  async toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState> {
    const state = await this.overviewApi.toggleGuestAccess(projectId, active)
    guestAccessStore.set(state.token, active ? 'active' : 'revoked')
    this.lastGuestToken = state.token
    return state
  }

  async generateGuestToken(projectId: string): Promise<GuestAccessState> {
    const state = await this.overviewApi.generateGuestToken(projectId)
    if (this.lastGuestToken && this.lastGuestToken !== state.token) {
      guestAccessStore.set(this.lastGuestToken, 'revoked')
    }
    guestAccessStore.set(state.token, 'active')
    this.lastGuestToken = state.token
    return state
  }

  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]> { return this.taskApi.getMyTasks(projectId, userId) }
  updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask> { return this.taskApi.updateTaskStatus(taskId, newStatus, rejectReason) }
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> { return this.taskApi.submitTaskArtifact(dto) }
  getProjectMembers(projectId: string): Promise<UserSummary[]> { return this.taskApi.getProjectMembers(projectId) }

  /* Project Governance & Settings */
  getProjectSettings(projectId: string): Promise<ProjectSettingsDto> { return this.settingsApi.getProjectSettings(projectId) }
  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto> { return this.settingsApi.updateProjectSettings(projectId, cmd) }
  publishPipeline(projectId: string): Promise<PublishPipelineResult> { return this.settingsApi.publishPipeline(projectId) }
  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]> { return this.settingsApi.getProjectMembersDetailed(projectId) }
  getProjectMemberHistory(projectId: string): Promise<ProjectMemberHistoryItem[]> { return this.settingsApi.getProjectMemberHistory(projectId) }
  inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail> { return this.settingsApi.inviteProjectMember(projectId, cmd) }
  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail> { return this.settingsApi.changeMemberRole(projectId, userId, cmd) }
  removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }> { return this.settingsApi.removeProjectMember(projectId, userId) }
  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]> { return this.settingsApi.getProjectAuditLogs(projectId) }
  archiveProject(projectId: string): Promise<ProjectSettingsDto> {
    this.workspaceApi.updateProjectStatus(projectId, 'ARCHIVED')
    return this.settingsApi.archiveProject(projectId)
  }
  restoreProject(projectId: string): Promise<ProjectSettingsDto> {
    this.workspaceApi.updateProjectStatus(projectId, 'ACTIVE')
    return this.settingsApi.restoreProject(projectId)
  }
  deleteProject(projectId: string): Promise<void> {
    this.workspaceApi.deleteProject(projectId)
    return this.settingsApi.deleteProject(projectId)
  }

  /* Project Invitations */
  createProjectInvitation(projectId: string, cmd: InviteMemberCommand): Promise<ProjectInvitationDto> {
    return this.settingsApi.createProjectInvitation(projectId, cmd)
  }
  getProjectPendingInvitations(projectId: string): Promise<ProjectInvitationDto[]> {
    return this.settingsApi.getProjectPendingInvitations(projectId)
  }
  getInvitationDetail(invitationId: string): Promise<ProjectInvitationDto | null> {
    return this.settingsApi.getInvitation(invitationId)
  }
  getInvitation(invitationId: string): Promise<ProjectInvitationDto | null> {
    return this.settingsApi.getInvitation(invitationId)
  }
  acceptInvitation(invitationId: string): Promise<{ success: boolean; projectId?: string }> {
    return this.settingsApi.acceptInvitation(invitationId)
  }
  rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
    return this.settingsApi.rejectInvitation(invitationId)
  }
  revokeInvitation(projectId: string, invitationId: string): Promise<boolean> {
    return this.settingsApi.revokeInvitation(projectId, invitationId)
  }

  /* Artifacts Hub */
  private mockArtifacts: Map<string, ProjectArtifactItem[]> = new Map()

  async getProjectArtifacts(projectId: string): Promise<ProjectArtifactItem[]> {
    if (!this.mockArtifacts.has(projectId)) {
      this.mockArtifacts.set(projectId, structuredClone(INITIAL_PROJECT_ARTIFACTS))
    }
    return structuredClone(this.mockArtifacts.get(projectId) || [])
  }

  async createArtifact(projectId: string, payload: CreateArtifactCommand): Promise<ProjectArtifactItem> {
    const list = await this.getProjectArtifacts(projectId)
    const newArt: ProjectArtifactItem = {
      id: `art-${Date.now()}`,
      projectId,
      nodeId: payload.nodeId || null,
      name: payload.name,
      title: payload.name,
      type: payload.type || 'OTHER_LINK',
      url: payload.url,
      isInRepository: payload.isInRepository !== false,
      isPublicForGuest: true,
      uploadedBy: 'Alex Kim',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    }
    list.unshift(newArt)
    this.mockArtifacts.set(projectId, list)
    return structuredClone(newArt)
  }

  async deleteArtifact(projectId: string, artifactId: string): Promise<void> {
    const list = await this.getProjectArtifacts(projectId)
    this.mockArtifacts.set(projectId, list.filter((a) => a.id !== artifactId))
  }

  /* Dev & Simulation capabilities */
  async resetMockData(): Promise<void> {
    this.taskApi.reset()
    this.settingsApi.reset()
    this.overviewApi.reset()
    guestAccessStore.clear()
    this.lastGuestToken = null
  }

  setMockLatency(ms: number): void {
    MockConfig.latencyMs = ms
  }

  setMockError(hasError: boolean): void {
    MockConfig.fakeError500 = hasError
  }

  setMockCycleError(simulate: boolean): void {
    MockConfig.simulateCycle = simulate
  }

  async setProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    this.settingsApi.setProjectStatus(status)
    this.overviewApi.setProjectStatus(status)
    this.workspaceApi.updateProjectStatus(projectId, status)
  }

  async createPhase(dto: CreatePhaseDto, projectId?: string): Promise<MacroPhase> {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const pId = projectId || dto.projectId
    if (pId && pId !== '1') {
      return addPhaseToProject(pId, dto)
    }
    const timestamp = Date.now()
    const id = `p_${timestamp}_${this.phases.length}`
    const smartPos = computeSmartMacroPhasePosition(this.phases, dto.parentPhaseId)
    const phase: MacroPhase = {
      id,
      name: dto.name,
      sub: dto.sub ?? 'Nền tảng mới',
      status: dto.parentPhaseId ? 'LOCKED' : 'TODO',
      pct: 0,
      accent: dto.accent ?? (dto.parentPhaseId ? 'slate' : 'blue'),
      x: dto.x ?? smartPos.x,
      y: dto.y ?? smartPos.y,
      w: 440,
      h: 170,
      parentPhaseIds: dto.parentPhaseId ? [dto.parentPhaseId] : [],
    }
    const rootTree = seedSimple(`${dto.name}: ${phase.sub}`, `Dự án Marketing Q4 › ${phase.name}`, 0, { prLink: null, prMerged: false, swagger: '' }, `Track: ${phase.sub}`, 'TODO', 'Khởi tạo Phase', 'TODO', '', '', 'Chưa có')
    TREES[id] = { title: phase.name, breadcrumb: `Dự án Marketing Q4 › ${phase.name}`, pct: 0, gate: { prLink: null, prMerged: false, swagger: '' }, nodes: rootTree.nodes }
    this.phases = [...this.phases, phase]
    if (pId) {
      addPhaseToProject(pId, dto)
    }
    return phase
  }

  async connectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    if (projectId && projectId !== '1') {
      const ok = connectPhasesInProject(projectId, sourcePhaseId, targetPhaseId)
      if (!ok) throw new Error('Phase không tồn tại')
      return
    }
    const target = this.phases.find((phase) => phase.id === targetPhaseId)
    if (!target || !this.phases.some((phase) => phase.id === sourcePhaseId)) {
      if (projectId) {
        const ok = connectPhasesInProject(projectId, sourcePhaseId, targetPhaseId)
        if (ok) return
      }
      throw new Error('Phase không tồn tại')
    }
    if (target.parentPhaseIds.includes(sourcePhaseId)) throw new Error('Liên kết giữa 2 Phase đã tồn tại')
    const phaseMap = Object.fromEntries(this.phases.map((phase) => [phase.id, phase]))
    if (isPhaseAncestor(phaseMap, targetPhaseId, sourcePhaseId)) throw new Error('Không thể nối ngược (tránh chu trình lặp đồ thị)')
    target.parentPhaseIds = [...target.parentPhaseIds, sourcePhaseId]
    target.locked = true
    target.status = 'LOCKED'
    if (projectId) {
      connectPhasesInProject(projectId, sourcePhaseId, targetPhaseId)
    }
  }

  async disconnectPhases(sourcePhaseId: string, targetPhaseId: string, projectId?: string): Promise<void> {
    if (projectId && projectId !== '1') {
      disconnectPhasesInProject(projectId, sourcePhaseId, targetPhaseId)
      return
    }
    const target = this.phases.find((phase) => phase.id === targetPhaseId)
    if (target) {
      target.parentPhaseIds = target.parentPhaseIds.filter((parent) => parent !== sourcePhaseId)
      if (target.parentPhaseIds.length === 0) {
        target.locked = false
        target.status = 'IN_PROGRESS'
      }
    }
    if (projectId) {
      disconnectPhasesInProject(projectId, sourcePhaseId, targetPhaseId)
    }
  }

  async deletePhase(phaseId: string, projectId?: string): Promise<void> {
    if (projectId && projectId !== '1') {
      deletePhaseInProject(projectId, phaseId)
    }
    this.phases = this.phases.filter((phase) => phase.id !== phaseId).map((phase) => ({ ...phase, parentPhaseIds: phase.parentPhaseIds.filter((parent) => parent !== phaseId) }))
    delete TREES[phaseId]
    if (projectId) {
      deletePhaseInProject(projectId, phaseId)
    }
  }

  async updatePhasePosition(phaseId: string, pos: { x: number; y: number }, projectId?: string): Promise<void> {
    if (projectId && projectId !== '1') {
      updatePhasePositionInProject(projectId, phaseId, pos)
      return
    }
    const found = this.phases.find((p) => p.id === phaseId)
    if (found) {
      found.x = pos.x
      found.y = pos.y
    }
    if (projectId) {
      updatePhasePositionInProject(projectId, phaseId, pos)
    }
  }
}
