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

export type WeekdayLabel = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'
export interface DailyVelocity {
  day: WeekdayLabel
  tasks: number
  isPeak: boolean
}
export interface WeeklyVelocity {
  periodLabel: string
  days: DailyVelocity[]
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
export interface AiDiagnosticReport {
  engine: 'Gemini'
  generatedAt: ISODateTime
  insights: AiDiagnosticInsight[]
}

export interface GuestAccessState {
  isActive: boolean
  token: string
  expiresAt: ISODateTime
  expiresLabel: string
}
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
  nodeRef: { nodeId: string; code: string; title: string }
  content: string
  status: FeedbackStatus
  replyContent?: string | null
  createdAt: ISODateTime
}

export type ActivityAction = 'SUBMITTED_PR' | 'APPROVED' | 'OVERDUE_ALERT' | 'CLAIMED'
export interface ActivityItem {
  id: string
  actor: { initials: string; name: string; avatarClass: string }
  action: ActivityAction
  message: string
  nodeCode: string
  occurredAt: ISODateTime
}

export interface OverviewData {
  project: {
    id: string
    name: string
    role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
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
