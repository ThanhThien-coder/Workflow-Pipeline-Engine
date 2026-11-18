/** Khớp CHECK constraint bảng NODE.status (SSOT §4.5) */
export type NodeStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
/** Khối breakdown của Overview chỉ hiển thị 4 trạng thái */
export type BreakdownStatus = Exclude<NodeStatus, 'REVIEW'>

export type ISODateTime = string

export interface OverviewMetrics {
  totalNodes: number
  criticalPathNodes: number
  completedNodes: number
  completionRate: number
  overdueCount: number
  blockingReleaseCount: number
  pendingReviewCount: number
}

export type WeekdayLabel = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'
export interface DailyVelocity {
  day: WeekdayLabel
  tasks: number
  isPeak: boolean
}
export interface WeeklyVelocity {
  periodLabel: string
  days: DailyVelocity[]
  hasData?: boolean
  unavailableNote?: string
}

export interface TaskStatusBreakdownItem {
  status: BreakdownStatus
  label: string
  percent: number
  taskCount: number
  barClass: string
  dotClass: string
}
export interface TaskStatusBreakdown {
  totalTasks: number
  items: TaskStatusBreakdownItem[]
}

export type InsightKind = 'CRITICAL_PATH' | 'BOTTLENECK' | 'RECOMMENDATION'
export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'ADVICE'
export interface AiDiagnosticInsight {
  id: string
  kind: InsightKind
  severity: InsightSeverity
  icon: string
  kicker: string
  tag: string
  title: string
  description: string
  relatedNodeIds: string[]
  boxClass: string
  tagClass: string
}
/** Nguồn của bản chẩn đoán, lấy từ trường `source` mà backend/dịch vụ AI trả về. */
export type AiDiagnosisSource = 'AI_SERVICE' | 'HEURISTIC_FALLBACK' | 'MOCK' | 'MOCK_FALLBACK' | 'UNKNOWN'
/** Nhãn hiện cho người dùng, suy ra từ source. Chỉ AI_SERVICE mới được ghi là Gemini. */
export type AiDiagnosisEngine = 'Gemini' | 'Fallback analysis' | 'Sample data' | 'Unknown source'

export type AiMetricsStatus = 'STABLE_GREEN' | 'YELLOW_WARNING' | 'RED_ALERT' | 'INSUFFICIENT_DATA' | 'OVERDUE' | 'UNKNOWN'
/** metrics của bản chẩn đoán. Trường nào backend/Python chưa trả thì là null (dạng cũ chưa có completedLast7Days, overdueDays, remainingTasks). */
export interface AiDiagnosisMetrics {
  status: AiMetricsStatus
  driftScore: number | null
  completedLast7Days: number | null
  overdueDays: number | null
  remainingTasks: number | null
}

export interface AiDiagnosticReport {
  engine: AiDiagnosisEngine
  /** Không có ở dữ liệu mock cũ; chế độ API luôn có. */
  source?: AiDiagnosisSource
  /** Gộp `warning` và `rateLimitWarning` của backend; có thì popover hiện dòng cảnh báo vàng. */
  warning?: string
  metrics?: AiDiagnosisMetrics
  /** Nhận định nguyên nhân gốc (chuỗi từ backend/Python, có thể thiếu). */
  rootCauseNotes?: string
  generatedAt: ISODateTime
  insights: AiDiagnosticInsight[]
  hasAnalysis?: boolean
  emptyMessage?: string
}

export interface GuestAccessState {
  isActive: boolean
  token: string
  expiresAt: ISODateTime
  expiresLabel: string
  /** true when the link was revoked (this session, or the backend reported status REVOKED) */
  revoked?: boolean
  /** Detailed link state from the backend; absent in older payloads (then derived from isActive) */
  status?: GuestLinkStatus
}
export type GuestLinkStatus = 'none' | 'active' | 'expired' | 'revoked'

export interface GuestAccessActions {
  copyLink: () => Promise<void>
  revoke: () => Promise<void>
  generate: () => Promise<void>
}

export type FeedbackStatus = 'OPEN' | 'RESOLVED'
export type ReviewerRole = 'TEACHER' | 'GUEST'
export interface FeedbackItem {
  id: string
  reviewerName: string
  reviewerRole: ReviewerRole
  nodeRef: { nodeId: string; code: string; title: string } | null
  content: string
  status: FeedbackStatus
  replyContent?: string | null
  createdAt: ISODateTime
}

export type ActivityAction = 'SUBMITTED_PR' | 'APPROVED' | 'OVERDUE_ALERT' | 'CLAIMED'
export interface ActivityItem {
  id: string
  actor: { id?: string | null; initials: string; name: string; avatarClass: string; avatarUrl?: string | null }
  action: ActivityAction
  message: string
  nodeCode: string
  occurredAt: ISODateTime
}

export interface OverviewData {
  project: {
    id: string
    name: string
    role: 'OWNER' | 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
    phaseLabel: string
    lastUpdatedAt: ISODateTime
  }
  metrics: OverviewMetrics
  velocity: WeeklyVelocity
  statusBreakdown: TaskStatusBreakdown
  aiReport: AiDiagnosticReport
  guestAccess: GuestAccessState
  feedbackQueue: FeedbackItem[]
  recentActivity: ActivityItem[]
}
