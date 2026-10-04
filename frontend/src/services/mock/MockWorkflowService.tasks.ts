import type { IWorkflowService } from '../contracts/IWorkflowService'
import type { ArtifactItem, ArtifactType, KanbanTask, PhaseId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import { evaluateTransition } from '../../domain/taskTransitions'
import { mockDelay } from './MockConfig'

export const MOCK_NOW = Date.parse('2026-10-02T00:00:00+07:00')
const PHASE_LABEL: Record<PhaseId, string> = { P1: 'Phase 1 · Foundation', P2A: 'Phase 2A · Auth', P2B: 'Phase 2B · Core', P3: 'Phase 3 · QA & Release' }

export const DEV_USERS: Omit<UserSummary, 'assignedTaskCount'>[] = [
  { id: '1', name: 'Alex Kim', roleTitle: 'Project Lead / Owner', initials: 'AK', avatarClass: 'bg-emerald-500', projectRole: 'OWNER' },
  { id: '2', name: 'Sarah Chen', roleTitle: 'Frontend Dev', initials: 'SC', avatarClass: 'bg-indigo-500', projectRole: 'COLLABORATOR' },
  { id: '3', name: 'Marcus Liu', roleTitle: 'Backend Dev', initials: 'ML', avatarClass: 'bg-rose-500', projectRole: 'COLLABORATOR' },
  { id: '4', name: 'Jamie Doe', roleTitle: 'QA / Viewer', initials: 'JD', avatarClass: 'bg-amber-500', projectRole: 'VIEWER' },
]

const due = (day: string) => `${day}T23:59:59+07:00`
const art = (id: string, type: ArtifactType, url: string, label?: string, note = ''): ArtifactItem => ({ id, type, url, note, uploadedAt: '2026-09-30T09:00:00+07:00', ...(label ? { label } : {}) })
const mk = (id: string, code: string, title: string, description: string, phaseId: PhaseId, status: TaskStatus, assignedUserId: string, dueDay: string, joinPolicySummary: string, artifacts: ArtifactItem[] = []): KanbanTask => ({ id, code, title, description, status, assignedUserId, phaseId, phaseLabel: PHASE_LABEL[phaseId], dueDate: due(dueDay), isOverdue: status !== 'DONE' && Date.parse(due(dueDay)) < MOCK_NOW, joinPolicySummary, artifacts, version: 0 })

// ─── Alex Kim    (id: '1') — 17 tasks: 5 TODO, 4 IN_PROGRESS, 4 REVIEW, 4 DONE ───
// ─── Sarah Chen (id: '2') — 17 tasks: 5 TODO, 5 IN_PROGRESS, 4 REVIEW, 3 DONE ───
// ─── Marcus Liu  (id: '3') — 18 tasks: 6 TODO, 5 IN_PROGRESS, 3 REVIEW, 4 DONE ───
// ─── Jamie Doe   (id: '4') — 0 active tasks (Viewer) ───
const SEED: KanbanTask[] = [
  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — TODO (5)                                ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a01', 'WPE-036', 'Checklist phát hành bản MVP', 'Danh mục kiểm tra trước khi chuyển Phase 3 sang Release.', 'P3', 'TODO', '1', '2026-10-12', 'AND-Join: 3 tiền đề đã xong'),
  mk('a02', 'WPE-037', 'Quy trình Onboarding Member', 'Flow thêm thành viên mới: invite link, role assignment, welcome email.', 'P2B', 'TODO', '1', '2026-10-10', 'OR-Join: 1/2 tiền đề đã xong'),
  mk('a03', 'WPE-038', 'Lập kế hoạch Sprint 3', 'Phân task cho Sprint 3: timeline, resource allocation, risk assessment.', 'P3', 'TODO', '1', '2026-10-15', 'AND-Join: 2 tiền đề đã xong'),
  mk('a04', 'WPE-039', 'Security Audit Checklist', 'Rà soát bảo mật: XSS, CSRF, SQL injection, auth bypass.', 'P3', 'TODO', '1', '2026-10-13', 'AND-Join: 4 tiền đề đã xong'),
  mk('a05', 'WPE-040', 'Performance Benchmark Plan', 'Xây dựng bộ benchmark cho API response time và frontend LCP.', 'P3', 'TODO', '1', '2026-10-16', 'OR-Join: 1/3 tiền đề đã xong'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — IN_PROGRESS (4)                         ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a06', 'WPE-041', 'Review Architecture Document', 'Đánh giá tài liệu kiến trúc tổng thể, cập nhật ADR decisions.', 'P2B', 'IN_PROGRESS', '1', '2026-10-05', 'AND-Join: 2 tiền đề đã xong'),
  mk('a07', 'WPE-042', 'Thiết lập Monitoring Stack', 'Cấu hình Grafana + Prometheus cho backend metrics và alerting.', 'P3', 'IN_PROGRESS', '1', '2026-10-07', 'OR-Join: 1/2 tiền đề đã xong'),
  mk('a08', 'WPE-043', 'API Gateway Configuration', 'Thiết lập rate limiting, CORS, và routing rules trên API gateway.', 'P2A', 'IN_PROGRESS', '1', '2026-10-04', 'AND-Join: 1 tiền đề đã xong'),
  mk('a09', 'WPE-044', 'Stakeholder Demo Preparation', 'Chuẩn bị slide deck và demo script cho stakeholder review.', 'P3', 'IN_PROGRESS', '1', '2026-09-30', 'AND-Join: 2 tiền đề đã xong'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — REVIEW (4)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a10', 'WPE-045', 'Rà soát chính sách nghiệm thu', 'Thống nhất định dạng minh chứng bắt buộc trước khi Review.', 'P2B', 'REVIEW', '1', '2026-10-03', 'AND-Join: 1 tiền đề đã xong', [art('a-a10', 'DOCS', 'https://docs.wpe.io/review-policy', 'Review policy', 'Bản nháp chờ chốt.')]),
  mk('a11', 'WPE-046', 'Deployment Pipeline Review', 'Kiểm tra luồng CI/CD từ PR merge đến production deployment.', 'P3', 'REVIEW', '1', '2026-10-06', 'AND-Join: 2 tiền đề đã xong', [art('a-a11', 'PR', 'https://github.com/wpe/infra/pull/18', 'PR #18', 'Terraform plan đã verify.')]),
  mk('a12', 'WPE-047', 'Error Handling Standards', 'Chuẩn hóa error response format và HTTP status code usage.', 'P2B', 'REVIEW', '1', '2026-10-04', 'OR-Join: 1/2 tiền đề đã xong', [art('a-a12', 'DOCS', 'https://docs.wpe.io/error-standards', 'Error Standards v1')]),
  mk('a13', 'WPE-048', 'Logging Convention Guide', 'Hướng dẫn structured logging: severity levels, context fields.', 'P2B', 'REVIEW', '1', '2026-10-02', 'AND-Join: 1 tiền đề đã xong', [art('a-a13', 'DOCS', 'https://docs.wpe.io/logging-guide', 'Logging Guide', 'Cần review severity mapping.')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  ALEX KIM — DONE (4)                                ║
  // ╚══════════════════════════════════════════════════════╝
  mk('a14', 'WPE-049', 'Kickoff & chốt SSOT', 'Chốt phạm vi MVP, RBAC matrix và vòng đời trạng thái.', 'P1', 'DONE', '1', '2026-09-10', 'Artifact: Tài liệu API', [art('a-a14', 'DOCS', 'https://docs.wpe.io/ssot', 'SSOT v1')]),
  mk('a15', 'WPE-050', 'Technical Risk Assessment', 'Đánh giá rủi ro kỹ thuật và đề xuất mitigation plan.', 'P1', 'DONE', '1', '2026-09-12', 'Artifact: Tài liệu', [art('a-a15', 'DOCS', 'https://docs.wpe.io/risk-assessment', 'Risk Report v1')]),
  mk('a16', 'WPE-051', 'Team Workflow Agreement', 'Thống nhất quy trình làm việc: Git flow, PR review, standup.', 'P1', 'DONE', '1', '2026-09-08', 'Artifact: Tài liệu', [art('a-a16', 'DOCS', 'https://docs.wpe.io/workflow-agreement', 'Workflow Agreement')]),
  mk('a17', 'WPE-052', 'Project Roadmap v1', 'Lộ trình dự án Q4 2026 với milestones và deliverables.', 'P1', 'DONE', '1', '2026-09-06', 'Artifact: Figma', [art('a-a17', 'FIGMA', 'https://figma.com/file/roadmap-q4', 'Roadmap Q4')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — TODO (5)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s01', 'WPE-001', 'Thiết kế UI Form đăng nhập', 'Dựng form Login/Register theo bản Figma, có validate phía client.', 'P2A', 'TODO', '2', '2026-10-06', 'AND-Join: 2 tiền đề đã xong'),
  mk('s02', 'WPE-002', 'Responsive Layout cho Mobile', 'Cấu hình breakpoint và tái bố trí grid cho viewport ≤768px.', 'P1', 'TODO', '2', '2026-10-08', 'OR-Join: 1/2 tiền đề đã xong'),
  mk('s03', 'WPE-003', 'Tạo Skeleton Loading Component', 'Component shimmer dùng chung cho card, table, chart.', 'P1', 'TODO', '2', '2026-10-09', 'AND-Join: 1 tiền đề đã xong'),
  mk('s04', 'WPE-004', 'Thiết kế Notification Panel', 'Panel chuông thông báo real-time với badge đếm chưa đọc.', 'P2B', 'TODO', '2', '2026-10-11', 'OR-Join: 1/3 tiền đề đã xong'),
  mk('s05', 'WPE-005', 'Dark Mode Toggle', 'Chuyển đổi giao diện sáng/tối, lưu preference vào localStorage.', 'P3', 'TODO', '2', '2026-10-14', 'AND-Join: 3 tiền đề đã xong'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — IN_PROGRESS (5)                       ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s06', 'WPE-006', 'Layout Dashboard Overview', 'Lưới KPI, biểu đồ cột Weekly Velocity và sidebar phải.', 'P2B', 'IN_PROGRESS', '2', '2026-10-01', 'AND-Join: 2 tiền đề đã xong'),
  mk('s07', 'WPE-007', 'Sidebar Navigation Component', 'Collapse/expand sidebar với icon + text, active indicator.', 'P1', 'IN_PROGRESS', '2', '2026-10-03', 'OR-Join: đã đạt ngưỡng'),
  mk('s08', 'WPE-008', 'Kanban Board Drag & Drop', 'Kéo thả card giữa cột với optimistic update và rollback.', 'P2B', 'IN_PROGRESS', '2', '2026-10-05', 'AND-Join: 1 tiền đề đã xong'),
  mk('s09', 'WPE-009', 'Biểu đồ Burndown Chart', 'Vẽ biểu đồ tiến độ Sprint bằng Canvas API, responsive.', 'P2B', 'IN_PROGRESS', '2', '2026-09-29', 'AND-Join: 2 tiền đề đã xong'),
  mk('s10', 'WPE-010', 'Search & Filter Toolbar', 'Thanh tìm kiếm với debounce, lọc theo phase và trạng thái.', 'P2B', 'IN_PROGRESS', '2', '2026-10-02', 'OR-Join: 1/2 tiền đề đã xong'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — REVIEW (4)                            ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s11', 'WPE-011', 'Form khởi tạo dự án', 'Tạo dự án mới hoặc clone Template quy trình chuẩn.', 'P2B', 'REVIEW', '2', '2026-10-04', 'AND-Join: 1 tiền đề đã xong', [art('a-s11', 'PR', 'https://github.com/wpe/web/pull/42', undefined, 'Đã tự test trên Chrome/Safari.')]),
  mk('s12', 'WPE-012', 'Avatar Upload Component', 'Upload ảnh đại diện với crop, resize và preview trước khi lưu.', 'P2A', 'REVIEW', '2', '2026-10-03', 'AND-Join: 2 tiền đề đã xong', [art('a-s12', 'PR', 'https://github.com/wpe/web/pull/55', 'PR #55', 'Crop logic cần review thêm.')]),
  mk('s13', 'WPE-013', 'Toast Notification System', 'Hệ thống thông báo toast với auto-dismiss và stack management.', 'P2B', 'REVIEW', '2', '2026-10-05', 'OR-Join: 1/2 tiền đề đã xong', [art('a-s13', 'PR', 'https://github.com/wpe/web/pull/61', 'PR #61')]),
  mk('s14', 'WPE-014', 'Breadcrumb Navigation', 'Thanh điều hướng breadcrumb tự động generate từ route config.', 'P1', 'REVIEW', '2', '2026-10-02', 'AND-Join: 1 tiền đề đã xong', [art('a-s14', 'FIGMA', 'https://figma.com/file/breadcrumb-v2', 'Figma Breadcrumb v2')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  SARAH CHEN — DONE (3)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('s15', 'WPE-015', 'Bộ component Button / Input', 'Chuẩn hóa design token và các biến thể component dùng chung.', 'P1', 'DONE', '2', '2026-09-20', 'Artifact: Figma specs', [art('a-s15', 'FIGMA', 'https://figma.com/file/ds-core', 'Figma specs')]),
  mk('s16', 'WPE-016', 'Typography System', 'Hệ thống font-size, line-height, font-weight theo design scale.', 'P1', 'DONE', '2', '2026-09-18', 'Artifact: Tài liệu', [art('a-s16', 'DOCS', 'https://docs.wpe.io/typography', 'Typography Guide')]),
  mk('s17', 'WPE-017', 'Color Palette & Tokens', 'Bảng màu semantic (primary, danger, success) với CSS variables.', 'P1', 'DONE', '2', '2026-09-15', 'Artifact: Figma specs', [art('a-s17', 'FIGMA', 'https://figma.com/file/color-tokens', 'Color Tokens v1')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — TODO (6)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m01', 'WPE-018', 'Claim Node bằng Optimistic Locking', "UPDATE ... WHERE status='TODO' AND version=:v, trả 409 nếu 0 dòng.", 'P2B', 'TODO', '3', '2026-10-08', 'AND-Join: 2 tiền đề đã xong'),
  mk('m02', 'WPE-019', 'Scheduled Job quét trễ hạn', 'Gán is_overdue cho node IN_PROGRESS / REVIEW quá due_date.', 'P3', 'TODO', '3', '2026-10-14', 'OR-Join: 1/2 tiền đề đã xong'),
  mk('m03', 'WPE-020', 'Rate Limiter Middleware', 'Giới hạn request/phút theo IP và user, trả 429 khi vượt ngưỡng.', 'P2A', 'TODO', '3', '2026-10-10', 'AND-Join: 1 tiền đề đã xong'),
  mk('m04', 'WPE-021', 'Database Migration Script v2', 'Script migrate thêm bảng audit_log và cột expires_at vào sessions.', 'P1', 'TODO', '3', '2026-10-09', 'AND-Join: 2 tiền đề đã xong'),
  mk('m05', 'WPE-022', 'WebSocket Event Bus', 'Kênh pub/sub real-time cho notification, task update, chat.', 'P2B', 'TODO', '3', '2026-10-12', 'OR-Join: 1/3 tiền đề đã xong'),
  mk('m06', 'WPE-023', 'Backup & Restore Endpoint', 'API export/import dữ liệu project dạng JSON cho disaster recovery.', 'P3', 'TODO', '3', '2026-10-15', 'AND-Join: 3 tiền đề đã xong'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — IN_PROGRESS (5)                       ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m07', 'WPE-024', 'Dịch vụ cấp phát JWT', 'Sinh/xác minh JWT, refresh token và chặn tài khoản bị khóa.', 'P2A', 'IN_PROGRESS', '3', '2026-09-28', 'AND-Join: 2 tiền đề đã xong'),
  mk('m08', 'WPE-025', 'Thuật toán Kahn kiểm tra chu trình', 'Chặn DRAFT → ACTIVE nếu đồ thị có vòng, trả danh sách node vi phạm.', 'P2B', 'IN_PROGRESS', '3', '2026-10-07', 'OR-Join: 1/2 tiền đề đã xong'),
  mk('m09', 'WPE-026', 'Email Service Integration', 'Gửi email xác thực, reset password qua SendGrid API.', 'P2A', 'IN_PROGRESS', '3', '2026-10-04', 'AND-Join: 1 tiền đề đã xong'),
  mk('m10', 'WPE-027', 'Audit Log Middleware', 'Ghi lại mọi mutation (create, update, delete) vào bảng audit_log.', 'P2B', 'IN_PROGRESS', '3', '2026-10-06', 'AND-Join: 2 tiền đề đã xong'),
  mk('m11', 'WPE-028', 'File Upload Service', 'Upload file lên S3-compatible storage với presigned URL.', 'P2B', 'IN_PROGRESS', '3', '2026-09-30', 'OR-Join: đã đạt ngưỡng'),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — REVIEW (3)                            ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m12', 'WPE-029', 'API Auth endpoints', 'POST /auth/register, /auth/login, GET /auth/me kèm DTO.', 'P2A', 'REVIEW', '3', '2026-10-01', 'AND-Join: 2 tiền đề đã xong', [art('a-m12', 'PR', 'https://github.com/wpe/api/pull/38', undefined, 'Cần Lead soát lại thời hạn JWT.')]),
  mk('m13', 'WPE-030', 'RBAC Permission Guard', 'Middleware kiểm tra quyền OWNER/COLLABORATOR/VIEWER trước mutation.', 'P2A', 'REVIEW', '3', '2026-10-03', 'AND-Join: 1 tiền đề đã xong', [art('a-m13', 'PR', 'https://github.com/wpe/api/pull/45', 'PR #45', 'Unit test coverage 92%.')]),
  mk('m14', 'WPE-031', 'Pagination & Cursor API', 'Cursor-based pagination cho list endpoints, hỗ trợ sort và filter.', 'P2B', 'REVIEW', '3', '2026-10-05', 'OR-Join: 1/2 tiền đề đã xong', [art('a-m14', 'DOCS', 'https://docs.wpe.io/pagination', 'Pagination Spec v2')]),

  // ╔══════════════════════════════════════════════════════╗
  // ║  MARCUS LIU — DONE (4)                              ║
  // ╚══════════════════════════════════════════════════════╝
  mk('m15', 'WPE-032', 'Thiết kế Data Schema PostgreSQL', '8 bảng chuẩn hóa, JSONB cho guest_access / ui_metadata.', 'P1', 'DONE', '3', '2026-09-18', 'Artifact: Tài liệu API', [art('a-m15', 'DOCS', 'https://docs.wpe.io/schema', 'Schema v1.0')]),
  mk('m16', 'WPE-033', 'Seed Data Script', 'Script tạo dữ liệu mẫu cho development và demo environment.', 'P1', 'DONE', '3', '2026-09-16', 'Artifact: ZIP', [art('a-m16', 'ZIP', 'https://storage.wpe.io/seeds/v1.zip', 'Seed v1')]),
  mk('m17', 'WPE-034', 'Docker Compose Setup', 'Cấu hình Docker Compose cho PostgreSQL, Redis, API server.', 'P1', 'DONE', '3', '2026-09-14', 'Artifact: Tài liệu', [art('a-m17', 'DOCS', 'https://docs.wpe.io/docker-setup', 'Docker Guide')]),
  mk('m18', 'WPE-035', 'CI Pipeline cho Backend', 'GitHub Actions: lint, test, build Docker image, push registry.', 'P1', 'DONE', '3', '2026-09-12', 'Artifact: PR Merged', [art('a-m18', 'PR', 'https://github.com/wpe/api/pull/12', 'PR #12')]),
]

export class MockTaskApi implements Pick<IWorkflowService, 'getMyTasks' | 'updateTaskStatus' | 'submitTaskArtifact' | 'getProjectMembers'> {
  private tasks = structuredClone(SEED)

  async getMyTasks(_projectId: string, userId: string): Promise<KanbanTask[]> {
    await mockDelay()
    return structuredClone(this.tasks.filter((task) => task.assignedUserId === userId))
  }

  async getProjectMembers(_projectId: string): Promise<UserSummary[]> {
    await mockDelay(100)
    return DEV_USERS.map((user) => ({
      ...user,
      assignedTaskCount: this.tasks.filter((task) => task.assignedUserId === user.id).length,
    }))
  }

  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<KanbanTask> {
    await mockDelay(150)
    const task = this.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('Không tìm thấy task')
    const actor = DEV_USERS.find((user) => user.id === task.assignedUserId)
    if (!actor) throw new Error('Không tìm thấy người thực hiện')
    const decision = evaluateTransition(task, newStatus, actor)
    if (decision.kind !== 'allow') throw new Error(decision.kind === 'deny' ? decision.message : 'Cần nộp Artifact')
    task.status = newStatus
    task.version += 1
    return structuredClone(task)
  }

  async submitTaskArtifact(dto: SubmitArtifactDto): Promise<{ task: KanbanTask; artifact: ArtifactItem }> {
    await mockDelay(200)
    const task = this.tasks.find((item) => item.id === dto.taskId)
    if (!task || task.status !== 'IN_PROGRESS') throw new Error('Chỉ nộp được task đang thực hiện')
    const artifact: ArtifactItem = {
      id: `a${Date.now()}`,
      type: dto.type,
      url: dto.url,
      note: dto.note,
      uploadedAt: new Date().toISOString(),
    }
    task.artifacts.push(artifact)
    task.status = 'REVIEW'
    task.version += 1
    return structuredClone({ task, artifact })
  }

  reset(): void {
    this.tasks = structuredClone(SEED)
  }
}
