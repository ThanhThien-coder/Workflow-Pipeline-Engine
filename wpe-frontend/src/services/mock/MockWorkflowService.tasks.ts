import type { IWorkflowService } from '../contracts/IWorkflowService'
import type { ArtifactItem, ArtifactType, KanbanTask, PhaseId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import { evaluateTransition } from '../../domain/taskTransitions'
import { mockDelay } from './MockConfig'
import { getSavedAvatar } from '../../utils/avatarUtils'
import { isTaskInPhase } from '../../utils/phaseTaskMatcher'

export const MOCK_NOW = Date.parse('2026-10-02T00:00:00+07:00')
type MockPhaseId = 'P1' | 'P2A' | 'P2B' | 'P3'
const PHASE_LABEL: Record<MockPhaseId, string> = { P1: 'Phase 1 · Foundation', P2A: 'Phase 2A · Auth', P2B: 'Phase 2B · Core', P3: 'Phase 3 · QA & Release' }

export const DEV_USERS: Omit<UserSummary, 'assignedTaskCount'>[] = [
  { id: '1', name: 'Alex Kim', roleTitle: 'Project Lead / Owner', initials: 'AK', avatarClass: 'bg-emerald-500', projectRole: 'OWNER' },
  { id: '2', name: 'Sarah Chen', roleTitle: 'Frontend Dev', initials: 'SC', avatarClass: 'bg-indigo-500', projectRole: 'COLLABORATOR' },
  { id: '3', name: 'Marcus Liu', roleTitle: 'Backend Dev', initials: 'ML', avatarClass: 'bg-rose-500', projectRole: 'COLLABORATOR' },
  { id: '4', name: 'Jamie Doe', roleTitle: 'QA / Viewer', initials: 'JD', avatarClass: 'bg-amber-500', projectRole: 'VIEWER' },
]

const due = (day: string) => `${day}T23:59:59+07:00`
const art = (id: string, type: ArtifactType, url: string, label?: string, note = ''): ArtifactItem => ({ id, type, url, note, uploadedAt: '2026-09-30T09:00:00+07:00', ...(label ? { label } : {}) })
const mk = (id: string, code: string, title: string, description: string, phaseId: MockPhaseId, status: TaskStatus, assignedUserId: string, dueDay: string, joinPolicySummary: string, artifacts: ArtifactItem[] = []): KanbanTask => ({ id, code, title, description, status, assignedUserId, phaseId, phaseLabel: PHASE_LABEL[phaseId], dueDate: due(dueDay), isOverdue: status !== 'DONE' && Date.parse(due(dueDay)) < MOCK_NOW, joinPolicySummary, artifacts, version: 0 })

// ─── Alex Kim    (id: '1') — 17 tasks: 5 TODO, 4 IN_PROGRESS, 4 REVIEW, 4 DONE ───
// ─── Sarah Chen (id: '2') — 17 tasks: 5 TODO, 5 IN_PROGRESS, 4 REVIEW, 3 DONE ───
// ─── Marcus Liu  (id: '3') — 18 tasks: 6 TODO, 5 IN_PROGRESS, 3 REVIEW, 4 DONE ───
// ─── Jamie Doe   (id: '4') — 0 active tasks (Viewer) ───
const SEED: KanbanTask[] = [
  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — TODO (5)                                ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a01', 'WPE-036', 'MVP release checklist', 'Checks to complete before moving Phase 3 to Release.', 'P3', 'TODO', '1', '2026-10-12', 'AND-Join: 3 prerequisites completed'),
  mk('a02', 'WPE-037', 'Member onboarding flow', 'Flow for adding new members: invite link, role assignment, welcome email.', 'P2B', 'TODO', '1', '2026-10-10', 'OR-Join: 1/2 prerequisites completed'),
  mk('a03', 'WPE-038', 'Sprint 3 planning', 'Assign tasks for Sprint 3: timeline, resource allocation, risk assessment.', 'P3', 'TODO', '1', '2026-10-15', 'AND-Join: 2 prerequisites completed'),
  mk('a04', 'WPE-039', 'Security Audit Checklist', 'Security review: XSS, CSRF, SQL injection, auth bypass.', 'P3', 'TODO', '1', '2026-10-13', 'AND-Join: 4 prerequisites completed'),
  mk('a05', 'WPE-040', 'Performance Benchmark Plan', 'Build a benchmark suite for API response time and frontend LCP.', 'P3', 'TODO', '1', '2026-10-16', 'OR-Join: 1/3 prerequisites completed'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — IN_PROGRESS (4)                         ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a06', 'WPE-041', 'Review Architecture Document', 'Review the overall architecture document and update the ADR decisions.', 'P2B', 'IN_PROGRESS', '1', '2026-10-05', 'AND-Join: 2 prerequisites completed'),
  mk('a07', 'WPE-042', 'Set up the monitoring stack', 'Configure Grafana and Prometheus for backend metrics and alerting.', 'P3', 'IN_PROGRESS', '1', '2026-10-07', 'OR-Join: 1/2 prerequisites completed'),
  mk('a08', 'WPE-043', 'API Gateway Configuration', 'Set up rate limiting, CORS, and routing rules on the API gateway.', 'P2A', 'IN_PROGRESS', '1', '2026-10-04', 'AND-Join: 1 prerequisite completed'),
  mk('a09', 'WPE-044', 'Stakeholder Demo Preparation', 'Prepare the slide deck and demo script for the stakeholder review.', 'P3', 'IN_PROGRESS', '1', '2026-09-30', 'AND-Join: 2 prerequisites completed'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — REVIEW (4)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a10', 'WPE-045', 'Review acceptance policy', 'Agree on the required evidence format before Review.', 'P2B', 'REVIEW', '1', '2026-10-03', 'AND-Join: 1 prerequisite completed', [art('a-a10', 'DOCS', 'https://docs.wpe.io/review-policy', 'Review policy', 'Draft awaiting sign-off.')]),
  mk('a11', 'WPE-046', 'Deployment Pipeline Review', 'Check the CI/CD flow from PR merge to production deployment.', 'P3', 'REVIEW', '1', '2026-10-06', 'AND-Join: 2 prerequisites completed', [art('a-a11', 'PR', 'https://github.com/wpe/infra/pull/18', 'PR #18', 'Terraform plan verified.')]),
  mk('a12', 'WPE-047', 'Error Handling Standards', 'Standardize the error response format and HTTP status code usage.', 'P2B', 'REVIEW', '1', '2026-10-04', 'OR-Join: 1/2 prerequisites completed', [art('a-a12', 'DOCS', 'https://docs.wpe.io/error-standards', 'Error Standards v1')]),
  mk('a13', 'WPE-048', 'Logging Convention Guide', 'Guide to structured logging: severity levels, context fields.', 'P2B', 'REVIEW', '1', '2026-10-02', 'AND-Join: 1 prerequisite completed', [art('a-a13', 'DOCS', 'https://docs.wpe.io/logging-guide', 'Logging Guide', 'Severity mapping needs review.')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — DONE (4)                                ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a14', 'WPE-049', 'Kickoff and SSOT sign-off', 'Finalize the MVP scope, RBAC matrix, and status lifecycle.', 'P1', 'DONE', '1', '2026-09-10', 'Artifact: API documentation', [art('a-a14', 'DOCS', 'https://docs.wpe.io/ssot', 'SSOT v1')]),
  mk('a15', 'WPE-050', 'Technical Risk Assessment', 'Assess technical risks and propose a mitigation plan.', 'P1', 'DONE', '1', '2026-09-12', 'Artifact: Documentation', [art('a-a15', 'DOCS', 'https://docs.wpe.io/risk-assessment', 'Risk Report v1')]),
  mk('a16', 'WPE-051', 'Team Workflow Agreement', 'Agree on the team workflow: Git flow, PR review, standup.', 'P1', 'DONE', '1', '2026-09-08', 'Artifact: Documentation', [art('a-a16', 'DOCS', 'https://docs.wpe.io/workflow-agreement', 'Workflow Agreement')]),
  mk('a17', 'WPE-052', 'Project Roadmap v1', 'Q4 2026 project roadmap with milestones and deliverables.', 'P1', 'DONE', '1', '2026-09-06', 'Artifact: Figma', [art('a-a17', 'FIGMA', 'https://figma.com/file/roadmap-q4', 'Roadmap Q4')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — TODO (5)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s01', 'WPE-001', 'Design the sign-in form UI', 'Build the Login/Register form from the Figma design, with client-side validation.', 'P2A', 'TODO', '2', '2026-10-06', 'AND-Join: 2 prerequisites completed'),
  mk('s02', 'WPE-002', 'Responsive Layout cho Mobile', 'Configure breakpoints and rearrange the grid for viewports up to 768px.', 'P1', 'TODO', '2', '2026-10-08', 'OR-Join: 1/2 prerequisites completed'),
  mk('s03', 'WPE-003', 'Create the Skeleton Loading component', 'Shared shimmer component for cards, tables, and charts.', 'P1', 'TODO', '2', '2026-10-09', 'AND-Join: 1 prerequisite completed'),
  mk('s04', 'WPE-004', 'Design the Notification panel', 'Real-time notification bell panel with an unread count badge.', 'P2B', 'TODO', '2', '2026-10-11', 'OR-Join: 1/3 prerequisites completed'),
  mk('s05', 'WPE-005', 'Dark Mode Toggle', 'Switch between light and dark themes and save the preference to localStorage.', 'P3', 'TODO', '2', '2026-10-14', 'AND-Join: 3 prerequisites completed'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — IN_PROGRESS (5)                       ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s06', 'WPE-006', 'Layout Dashboard Overview', 'KPI grid, Weekly Velocity bar chart, and right sidebar.', 'P2B', 'IN_PROGRESS', '2', '2026-10-01', 'AND-Join: 2 prerequisites completed'),
  mk('s07', 'WPE-007', 'Sidebar Navigation Component', 'Collapse/expand sidebar with icon and text, plus an active indicator.', 'P1', 'IN_PROGRESS', '2', '2026-10-03', 'OR-Join: threshold reached'),
  mk('s08', 'WPE-008', 'Kanban Board Drag & Drop', 'Drag cards between columns with optimistic update and rollback.', 'P2B', 'IN_PROGRESS', '2', '2026-10-05', 'AND-Join: 1 prerequisite completed'),
  mk('s09', 'WPE-009', 'Burndown chart', 'Draw the Sprint progress chart with the Canvas API, responsive.', 'P2B', 'IN_PROGRESS', '2', '2026-09-29', 'AND-Join: 2 prerequisites completed'),
  mk('s10', 'WPE-010', 'Search & Filter Toolbar', 'Search bar with debounce, filtering by phase and status.', 'P2B', 'IN_PROGRESS', '2', '2026-10-02', 'OR-Join: 1/2 prerequisites completed'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — REVIEW (4)                            ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s11', 'WPE-011', 'Create project form', 'Create a new project or clone a standard workflow template.', 'P2B', 'REVIEW', '2', '2026-10-04', 'AND-Join: 1 prerequisite completed', [art('a-s11', 'PR', 'https://github.com/wpe/web/pull/42', undefined, 'Self-tested on Chrome and Safari.')]),
  mk('s12', 'WPE-012', 'Avatar Upload Component', 'Upload a profile photo with crop, resize, and preview before saving.', 'P2A', 'REVIEW', '2', '2026-10-03', 'AND-Join: 2 prerequisites completed', [art('a-s12', 'PR', 'https://github.com/wpe/web/pull/55', 'PR #55', 'Crop logic needs further review.')]),
  mk('s13', 'WPE-013', 'Toast Notification System', 'Toast notification system with auto-dismiss and stack management.', 'P2B', 'REVIEW', '2', '2026-10-05', 'OR-Join: 1/2 prerequisites completed', [art('a-s13', 'PR', 'https://github.com/wpe/web/pull/61', 'PR #61')]),
  mk('s14', 'WPE-014', 'Breadcrumb Navigation', 'Breadcrumb navigation generated automatically from the route config.', 'P1', 'REVIEW', '2', '2026-10-02', 'AND-Join: 1 prerequisite completed', [art('a-s14', 'FIGMA', 'https://figma.com/file/breadcrumb-v2', 'Figma Breadcrumb v2')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — DONE (3)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s15', 'WPE-015', 'Button / Input components', 'Standardize design tokens and shared component variants.', 'P1', 'DONE', '2', '2026-09-20', 'Artifact: Figma specs', [art('a-s15', 'FIGMA', 'https://figma.com/file/ds-core', 'Figma specs')]),
  mk('s16', 'WPE-016', 'Typography System', 'Font-size, line-height, and font-weight system based on the design scale.', 'P1', 'DONE', '2', '2026-09-18', 'Artifact: Documentation', [art('a-s16', 'DOCS', 'https://docs.wpe.io/typography', 'Typography Guide')]),
  mk('s17', 'WPE-017', 'Color Palette & Tokens', 'Semantic color palette (primary, danger, success) with CSS variables.', 'P1', 'DONE', '2', '2026-09-15', 'Artifact: Figma specs', [art('a-s17', 'FIGMA', 'https://figma.com/file/color-tokens', 'Color Tokens v1')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — TODO (6)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m01', 'WPE-018', 'Claim a node with optimistic locking', "UPDATE ... WHERE status='TODO' AND version=:v, return 409 if 0 rows are updated.", 'P2B', 'TODO', '3', '2026-10-08', 'AND-Join: 2 prerequisites completed'),
  mk('m02', 'WPE-019', 'Scheduled job to detect overdue tasks', 'Set is_overdue on IN_PROGRESS / REVIEW nodes past their due_date.', 'P3', 'TODO', '3', '2026-10-14', 'OR-Join: 1/2 prerequisites completed'),
  mk('m03', 'WPE-020', 'Rate Limiter Middleware', 'Limit requests per minute by IP and user, and return 429 when the limit is exceeded.', 'P2A', 'TODO', '3', '2026-10-10', 'AND-Join: 1 prerequisite completed'),
  mk('m04', 'WPE-021', 'Database Migration Script v2', 'Migration script that adds the audit_log table and an expires_at column to sessions.', 'P1', 'TODO', '3', '2026-10-09', 'AND-Join: 2 prerequisites completed'),
  mk('m05', 'WPE-022', 'WebSocket Event Bus', 'Real-time pub/sub channel for notifications, task updates, and chat.', 'P2B', 'TODO', '3', '2026-10-12', 'OR-Join: 1/3 prerequisites completed'),
  mk('m06', 'WPE-023', 'Backup & Restore Endpoint', 'API to export/import project data as JSON for disaster recovery.', 'P3', 'TODO', '3', '2026-10-15', 'AND-Join: 3 prerequisites completed'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — IN_PROGRESS (5)                       ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m07', 'WPE-024', 'JWT issuing service', 'Issue and verify JWTs, refresh tokens, and block locked accounts.', 'P2A', 'IN_PROGRESS', '3', '2026-09-28', 'AND-Join: 2 prerequisites completed'),
  mk('m08', 'WPE-025', 'Kahn algorithm cycle check', 'Block DRAFT → ACTIVE when the graph has a cycle, and return the offending nodes.', 'P2B', 'IN_PROGRESS', '3', '2026-10-07', 'OR-Join: 1/2 prerequisites completed'),
  mk('m09', 'WPE-026', 'Email Service Integration', 'Send verification and password reset emails through the SendGrid API.', 'P2A', 'IN_PROGRESS', '3', '2026-10-04', 'AND-Join: 1 prerequisite completed'),
  mk('m10', 'WPE-027', 'Audit Log Middleware', 'Record every mutation (create, update, delete) in the audit_log table.', 'P2B', 'IN_PROGRESS', '3', '2026-10-06', 'AND-Join: 2 prerequisites completed'),
  mk('m11', 'WPE-028', 'File Upload Service', 'Upload files to S3-compatible storage with presigned URLs.', 'P2B', 'IN_PROGRESS', '3', '2026-09-30', 'OR-Join: threshold reached'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — REVIEW (3)                            ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m12', 'WPE-029', 'API Auth endpoints', 'POST /auth/register, /auth/login, and GET /auth/me with DTOs.', 'P2A', 'REVIEW', '3', '2026-10-01', 'AND-Join: 2 prerequisites completed', [art('a-m12', 'PR', 'https://github.com/wpe/api/pull/38', undefined, 'Lead should recheck the JWT expiry.')]),
  mk('m13', 'WPE-030', 'RBAC Permission Guard', 'Middleware that checks OWNER/COLLABORATOR/VIEWER permissions before a mutation.', 'P2A', 'REVIEW', '3', '2026-10-03', 'AND-Join: 1 prerequisite completed', [art('a-m13', 'PR', 'https://github.com/wpe/api/pull/45', 'PR #45', 'Unit test coverage 92%.')]),
  mk('m14', 'WPE-031', 'Pagination & Cursor API', 'Cursor-based pagination for list endpoints, with sort and filter support.', 'P2B', 'REVIEW', '3', '2026-10-05', 'OR-Join: 1/2 prerequisites completed', [art('a-m14', 'DOCS', 'https://docs.wpe.io/pagination', 'Pagination Spec v2')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — DONE (4)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m15', 'WPE-032', 'Design the PostgreSQL data schema', '8 normalized tables, with JSONB for guest_access / ui_metadata.', 'P1', 'DONE', '3', '2026-09-18', 'Artifact: API documentation', [art('a-m15', 'DOCS', 'https://docs.wpe.io/schema', 'Schema v1.0')]),
  mk('m16', 'WPE-033', 'Seed Data Script', 'Script that creates sample data for the development and demo environments.', 'P1', 'DONE', '3', '2026-09-16', 'Artifact: ZIP', [art('a-m16', 'ZIP', 'https://storage.wpe.io/seeds/v1.zip', 'Seed v1')]),
  mk('m17', 'WPE-034', 'Docker Compose Setup', 'Docker Compose configuration for PostgreSQL, Redis, and the API server.', 'P1', 'DONE', '3', '2026-09-14', 'Artifact: Documentation', [art('a-m17', 'DOCS', 'https://docs.wpe.io/docker-setup', 'Docker Guide')]),
  mk('m18', 'WPE-035', 'CI Pipeline cho Backend', 'GitHub Actions: lint, test, build Docker image, push registry.', 'P1', 'DONE', '3', '2026-09-12', 'Artifact: PR Merged', [art('a-m18', 'PR', 'https://github.com/wpe/api/pull/12', 'PR #12')]),
]

export class MockTaskApi implements Pick<IWorkflowService, 'getMyTasks' | 'getPhaseTasks' | 'getReviewTasks' | 'updateTaskStatus' | 'submitTaskArtifact' | 'getProjectMembers' | 'updateTaskAssignment'> {
  private tasks = structuredClone(SEED)

  async getMyTasks(_projectId: string, userId: string): Promise<KanbanTask[]> {
    await mockDelay()
    return structuredClone(this.tasks.filter((task) => task.assignedUserId === userId))
  }

  /** Dữ liệu mẫu: task có phaseId dạng P1/P2A…, khớp phase theo cùng quy tắc chuẩn hóa tên như giao diện cũ. */
  async getPhaseTasks(_projectId: string, phaseId: string): Promise<KanbanTask[]> {
    await mockDelay()
    return structuredClone(this.tasks.filter((task) => isTaskInPhase(task, { id: phaseId })))
  }

  async getReviewTasks(_projectId: string): Promise<KanbanTask[]> {
    await mockDelay()
    return structuredClone(this.tasks.filter((task) => task.status === 'REVIEW'))
  }

  async getProjectMembers(_projectId: string): Promise<UserSummary[]> {
    await mockDelay(100)
    return DEV_USERS.map((user) => {
      const savedAvatar = getSavedAvatar(user.name || user.id)
      return {
        ...user,
        avatarUrl: user.avatarUrl || savedAvatar,
        assignedTaskCount: this.tasks.filter((task) => task.assignedUserId === user.id).length,
      }
    })
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, rejectReason?: string): Promise<KanbanTask> {
    await mockDelay(150)
    const task = this.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('Task not found.')
    const isOwnerReviewAction = newStatus === 'DONE' || (task.status === 'REVIEW' && newStatus === 'IN_PROGRESS')
    const actor = isOwnerReviewAction
      ? DEV_USERS.find((u) => u.projectRole === 'OWNER') || DEV_USERS[0]
      : DEV_USERS.find((user) => user.id === task.assignedUserId)
    if (!actor) throw new Error('Assignee not found.')
    const decision = evaluateTransition(task, newStatus, actor)
    if (decision.kind !== 'allow') throw new Error(decision.kind === 'deny' ? decision.message : 'Submit an artifact first.')
    task.status = newStatus
    if (newStatus === 'IN_PROGRESS' && rejectReason) {
      task.rejectReason = rejectReason
    } else if (newStatus === 'REVIEW' || newStatus === 'DONE') {
      delete task.rejectReason
    }
    task.version += 1
    return structuredClone(task)
  }

  async submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> {
    await mockDelay(200)
    const task = this.tasks.find((item) => item.id === dto.taskId)
    if (!task || task.status !== 'IN_PROGRESS') throw new Error('Only tasks in progress can be submitted.')
    const artifact: ArtifactItem = {
      id: `a${Date.now()}`,
      type: dto.type ?? 'DOCS', // MockWorkflowService đã đoán loại theo link trước khi gọi vào đây
      url: dto.url || '',
      note: dto.note,
      uploadedAt: new Date().toISOString(),
    }
    if (dto.url && dto.url.trim()) {
      task.artifacts.push(artifact)
    }
    delete task.rejectReason
    task.status = 'REVIEW'
    task.version += 1
    return structuredClone({ task, artifact })
  }

  async updateTaskAssignment(
    taskId: string,
    cmd: { assignedUserId?: string; dueDate?: string; version: number }
  ): Promise<Pick<KanbanTask, 'assignedUserId' | 'dueDate' | 'version'>> {
    await mockDelay(100)
    const task = this.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('Task not found.')
    if (cmd.assignedUserId !== undefined) {
      task.assignedUserId = cmd.assignedUserId
    }
    if (cmd.dueDate !== undefined) {
      task.dueDate = cmd.dueDate
      task.isOverdue = task.status !== 'DONE' && Date.parse(task.dueDate) < MOCK_NOW
    }
    task.version += 1
    return {
      assignedUserId: task.assignedUserId,
      dueDate: task.dueDate,
      version: task.version,
    }
  }

  reset(): void {
    this.tasks = structuredClone(SEED)
  }
}
