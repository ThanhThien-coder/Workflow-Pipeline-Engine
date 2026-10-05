import type { GraphNode, GraphNodeMap, MacroPhase, NodeStatus, PhaseTree } from '../types/workflow.types'
import type { CreatePhaseDto, IWorkflowService } from './contracts/IWorkflowService'
import { isPhaseAncestor } from '../utils/spanningTreeLayout'
import { MockOverviewApi } from './mock/MockWorkflowService.overview'
import type { GuestAccessState, OverviewData } from '../types/overview.types'
import type { ArtifactItem, KanbanTask, SubmitArtifactDto, TaskStatus, UserSummary } from '../types/kanban.types'
import { MockTaskApi } from './mock/MockWorkflowService.tasks'
import { MockSettingsApi } from './mock/MockWorkflowService.settings'
import { MockAuthApi } from './mock/MockWorkflowService.auth'
import { MockWorkspaceApi } from './mock/MockWorkflowService.workspace'
import { MockConfig } from './mock/MockConfig'
import type {
  ProjectSettingsDto,
  ProjectMemberDetail,
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
  CreateProjectCommand,
  ProjectSummaryDto,
} from '../types/workspace.types'

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
  getProjectsList(): Promise<readonly ProjectSummaryDto[]> {
    return this.workspaceApi.getProjectsList()
  }

  createProject(cmd: CreateProjectCommand): Promise<ProjectSummaryDto> {
    return this.workspaceApi.createProject(cmd)
  }

  async getMacroPhases(): Promise<MacroPhase[]> {
    return this.phases.map((phase) => ({ ...phase }))
  }

  async getPhaseEdges(): Promise<[string, string][]> {
    return this.phases.flatMap((phase) => phase.parentPhaseIds.map((parent) => [parent, phase.id] as [string, string]))
  }

  async getPhaseGraph(phaseId: string): Promise<GraphNodeMap> {
    if (phaseId === 'p2a') {
      return seedP2A()
    }
    const tree = TREES[phaseId]
    if (!tree) throw new Error(`Unknown phase: ${phaseId}`)
    return Object.fromEntries(Object.entries(tree.nodes).map(([id, graphNode]) => [id, { ...graphNode, parentIds: [...graphNode.parentIds] }]))
  }

  getOverviewData(projectId: string): Promise<OverviewData> {
    return this.overviewApi.getOverviewData(projectId)
  }

  toggleGuestAccess(projectId: string, active: boolean): Promise<GuestAccessState> {
    return this.overviewApi.toggleGuestAccess(projectId, active)
  }

  generateGuestToken(projectId: string): Promise<GuestAccessState> {
    return this.overviewApi.generateGuestToken(projectId)
  }

  getMyTasks(projectId: string, userId: string): Promise<KanbanTask[]> { return this.taskApi.getMyTasks(projectId, userId) }
  updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<KanbanTask> { return this.taskApi.updateTaskStatus(taskId, newStatus) }
  submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> { return this.taskApi.submitTaskArtifact(dto) }
  getProjectMembers(projectId: string): Promise<UserSummary[]> { return this.taskApi.getProjectMembers(projectId) }

  /* Project Governance & Settings */
  getProjectSettings(projectId: string): Promise<ProjectSettingsDto> { return this.settingsApi.getProjectSettings(projectId) }
  updateProjectSettings(projectId: string, cmd: UpdateProjectCommand): Promise<ProjectSettingsDto> { return this.settingsApi.updateProjectSettings(projectId, cmd) }
  publishPipeline(projectId: string, simulateCycle?: boolean): Promise<PublishPipelineResult> { return this.settingsApi.publishPipeline(projectId, simulateCycle) }
  getProjectMembersDetailed(projectId: string): Promise<ProjectMemberDetail[]> { return this.settingsApi.getProjectMembersDetailed(projectId) }
  inviteProjectMember(projectId: string, cmd: InviteMemberCommand): Promise<ProjectMemberDetail> { return this.settingsApi.inviteProjectMember(projectId, cmd) }
  changeMemberRole(projectId: string, userId: string, cmd: ChangeMemberRoleCommand): Promise<ProjectMemberDetail> { return this.settingsApi.changeMemberRole(projectId, userId, cmd) }
  removeProjectMember(projectId: string, userId: string): Promise<{ unassignedTaskCount: number }> { return this.settingsApi.removeProjectMember(projectId, userId) }
  getProjectAuditLogs(projectId: string): Promise<AuditLogItem[]> { return this.settingsApi.getProjectAuditLogs(projectId) }

  /* Dev & Simulation capabilities */
  async resetMockData(): Promise<void> {
    this.taskApi.reset()
    this.settingsApi.reset()
    this.overviewApi.reset()
  }

  setMockLatency(ms: number): void {
    MockConfig.latencyMs = ms
  }

  setMockError(hasError: boolean): void {
    MockConfig.fakeError500 = hasError
  }

  async setProjectStatus(_projectId: string, status: ProjectStatus): Promise<void> {
    this.settingsApi.setProjectStatus(status)
    this.overviewApi.setProjectStatus(status)
  }

  async createPhase(dto: CreatePhaseDto): Promise<MacroPhase> {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const timestamp = Date.now()
    const id = `p_${timestamp}_${this.phases.length}`
    const parent = dto.parentPhaseId ? this.phases.find((phase) => phase.id === dto.parentPhaseId) : undefined
    const phase: MacroPhase = {
      id,
      name: dto.name,
      sub: dto.sub ?? 'Nền tảng mới',
      status: 'TODO',
      pct: 0,
      accent: dto.accent ?? 'slate',
      x: dto.x ?? (parent ? parent.x + parent.w + 100 : 400),
      y: dto.y ?? (parent ? parent.y : 150),
      w: 250,
      h: 220,
      parentPhaseIds: parent ? [parent.id] : [],
    }
    const rootTree = seedSimple(`${dto.name}: ${phase.sub}`, `Dự án Marketing Q4 › ${phase.name}`, 0, { prLink: null, prMerged: false, swagger: '' }, `Track: ${phase.sub}`, 'TODO', 'Khởi tạo Phase', 'TODO', '', '', 'Chưa có')
    TREES[id] = { title: phase.name, breadcrumb: `Dự án Marketing Q4 › ${phase.name}`, pct: 0, gate: { prLink: null, prMerged: false, swagger: '' }, nodes: rootTree.nodes }
    this.phases = [...this.phases, phase]
    return phase
  }

  async connectPhases(sourcePhaseId: string, targetPhaseId: string): Promise<void> {
    const target = this.phases.find((phase) => phase.id === targetPhaseId)
    if (!target || !this.phases.some((phase) => phase.id === sourcePhaseId)) throw new Error('Phase không tồn tại')
    if (target.parentPhaseIds.includes(sourcePhaseId)) throw new Error('Liên kết giữa 2 Phase đã tồn tại')
    const phaseMap = Object.fromEntries(this.phases.map((phase) => [phase.id, phase]))
    if (isPhaseAncestor(phaseMap, targetPhaseId, sourcePhaseId)) throw new Error('Không thể nối ngược (tránh chu trình lặp đồ thị)')
    target.parentPhaseIds = [...target.parentPhaseIds, sourcePhaseId]
  }

  async deletePhase(phaseId: string): Promise<void> {
    this.phases = this.phases.filter((phase) => phase.id !== phaseId).map((phase) => ({ ...phase, parentPhaseIds: phase.parentPhaseIds.filter((parent) => parent !== phaseId) }))
    delete TREES[phaseId]
  }
}
