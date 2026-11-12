import { apiRequest } from '../../http/apiClient'
import type { FeedbackItem, FeedbackStatus, GuestAccessState, ReviewerRole } from '../../../types/overview.types'
import type {
  GuestFeedbackDto,
  GuestOverviewDto,
  GuestStatusKey,
  SubmitGuestFeedbackCommand,
} from '../../../types/guest.types'

/**
 * D5 — Lời gọi API cổng khách (Guest Gateway) và hàng đợi góp ý (Feedback Queue) (Cụm 7, 8).
 */

export interface BackendGuestAccessResponse {
  enabled?: boolean
  active?: boolean
  token?: string | null
  shareUrl?: string | null
  expiresAt?: string | null
}

export interface BackendFeedbackNodeRef {
  nodeId?: number | string | null
  id?: number | string | null
  code?: string | null
  title?: string | null
}

export interface BackendFeedbackResponse {
  id: number | string
  reviewerName?: string | null
  reviewerRole?: 'TEACHER' | 'GUEST' | string
  nodeRef?: BackendFeedbackNodeRef | null
  node?: BackendFeedbackNodeRef | null
  content?: string
  status?: 'OPEN' | 'RESOLVED' | string
  createdAt?: string
}

export interface BackendGuestVelocityPoint {
  day: string
  value: number
}

export interface BackendGuestStatusSlice {
  key: string
  label: string
  count: number
}

export interface BackendGuestActivity {
  id: string
  initials?: string
  actor: string
  text: string
  ago: string
}

export interface BackendGuestOverviewResponse {
  projectName?: string
  phaseLabel?: string
  lastUpdated?: string
  totalNodes?: number
  criticalNodes?: number
  completedNodes?: number
  completionPct?: number
  overdueCount?: number
  blockingCount?: number
  totalTasks?: number
  velocity?: BackendGuestVelocityPoint[]
  statusBreakdown?: BackendGuestStatusSlice[]
  recentActivity?: BackendGuestActivity[]
}

export interface CreateGuestFeedbackCommandDto {
  reviewerName?: string
  reviewerRole?: 'TEACHER' | 'GUEST'
  content?: string
  nodeId?: number | string | null
  sessionId?: string
  message?: string
}

function formatExpiresLabel(expiresAt?: string | null): string {
  if (!expiresAt) return 'Không thời hạn'
  const exp = new Date(expiresAt)
  const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const datePart = exp.toISOString().split('T')[0]
  if (diffDays <= 0) return `${datePart} (Hết hạn)`
  return `${datePart} (${diffDays} ngày còn lại)`
}

export function mapGuestAccessResponse(data: BackendGuestAccessResponse): GuestAccessState {
  const isActive = Boolean(data.enabled ?? data.active ?? false)
  const token = data.token ?? ''
  const expiresAt = data.expiresAt ? new Date(data.expiresAt).toISOString() : ''
  return {
    isActive,
    token,
    expiresAt,
    expiresLabel: isActive ? formatExpiresLabel(data.expiresAt) : 'Đã thu hồi',
  }
}

export function mapFeedbackResponse(item: BackendFeedbackResponse): FeedbackItem {
  const rawNode = item.nodeRef ?? item.node ?? null
  const nodeRef = rawNode
    ? {
        nodeId: String(rawNode.nodeId ?? rawNode.id ?? ''),
        code: String(rawNode.code ?? ''),
        title: String(rawNode.title ?? ''),
      }
    : null

  return {
    id: String(item.id),
    reviewerName: item.reviewerName || 'Khách truy cập',
    reviewerRole: (item.reviewerRole as ReviewerRole) || 'GUEST',
    nodeRef,
    content: item.content || '',
    status: (item.status as FeedbackStatus) || 'OPEN',
    // Backend là luồng góp ý 1 chiều, không có chức năng trả lời khách ngoài
    replyContent: null,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  }
}

export function mapGuestOverviewResponse(data: BackendGuestOverviewResponse): GuestOverviewDto {
  const totalNodes = data.totalNodes ?? 0
  const completedNodes = data.completedNodes ?? 0
  const completionPct =
    data.completionPct ?? (totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0)

  // Map các status key từ backend sang enum GuestStatusKey của FE
  const statusKeyMap: Record<string, GuestStatusKey> = {
    done: 'done',
    inProgress: 'inProgress',
    review: 'todo',
    todo: 'todo',
    locked: 'blocked',
    blocked: 'blocked',
  }

  const statusBreakdown = (data.statusBreakdown || []).map((s) => ({
    key: statusKeyMap[s.key] || (s.key as GuestStatusKey) || 'todo',
    label: s.label || s.key,
    count: s.count ?? 0,
  }))

  return {
    projectName: data.projectName || '',
    phaseLabel: data.phaseLabel || 'Toàn bộ quy trình',
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : new Date().toISOString(),
    totalNodes,
    criticalNodes: data.criticalNodes ?? 0,
    completedNodes,
    completionPct,
    overdueCount: data.overdueCount ?? 0,
    blockingCount: data.blockingCount ?? 0,
    totalTasks: data.totalTasks ?? totalNodes,
    velocity: (data.velocity || []).map((v) => ({
      day: v.day,
      value: v.value,
    })),
    statusBreakdown,
    recentActivity: (data.recentActivity || []).map((a) => ({
      id: String(a.id),
      initials: a.initials || (a.actor ? a.actor.slice(0, 2).toUpperCase() : 'WPE'),
      actor: a.actor || 'Hệ thống',
      text: a.text || '',
      ago: a.ago || 'gần đây',
    })),
  }
}

export function mapGuestFeedbackResponse(data: any): GuestFeedbackDto {
  return {
    id: String(data.id),
    author: data.reviewerName || 'Khách truy cập',
    message: data.content || '',
    createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
  }
}

// ───────────────────────── 7.1 & 7.2 Guest Link Endpoints ─────────────────────────

/** GET /projects/{projectId}/guest-token — lấy trạng thái link hiện tại (chỉ OWNER) */
export async function getGuestAccess(projectId: string | number): Promise<GuestAccessState> {
  const data = await apiRequest<BackendGuestAccessResponse>('GET', `/projects/${projectId}/guest-token`)
  return mapGuestAccessResponse(data)
}

/** POST /projects/{projectId}/guest-token — sinh mới hoặc gia hạn link khách (chỉ OWNER) */
export async function createOrRenewGuestToken(
  projectId: string | number,
  expiryDays?: number,
): Promise<GuestAccessState> {
  const data = await apiRequest<BackendGuestAccessResponse>('POST', `/projects/${projectId}/guest-token`, {
    body: expiryDays != null ? { expiryDays } : undefined,
  })
  return mapGuestAccessResponse(data)
}

/** DELETE /projects/{projectId}/guest-token — thu hồi link khách (chỉ OWNER) */
export async function revokeGuestToken(projectId: string | number): Promise<GuestAccessState> {
  const data = await apiRequest<BackendGuestAccessResponse>('DELETE', `/projects/${projectId}/guest-token`)
  return mapGuestAccessResponse(data)
}

// ───────────────────────── 8.2 & 8.3 Feedback Queue Endpoints ─────────────────────────

/** GET /projects/{projectId}/feedbacks — xem danh sách góp ý (mọi thành viên) */
export async function listFeedbacks(projectId: string | number): Promise<FeedbackItem[]> {
  const data = await apiRequest<BackendFeedbackResponse[]>('GET', `/projects/${projectId}/feedbacks`)
  return (data || []).map(mapFeedbackResponse)
}

/** PATCH /projects/{projectId}/feedbacks/{feedbackId}/resolve — đánh dấu góp ý đã xử lý (OWNER hoặc MANAGER) */
export async function resolveFeedback(
  projectId: string | number,
  feedbackId: string | number,
): Promise<void> {
  await apiRequest<void>('PATCH', `/projects/${projectId}/feedbacks/${feedbackId}/resolve`)
}

// ───────────────────────── 7.2 & 8.1 Guest Portal Endpoints (không cần đăng nhập) ─────────────────────────

/** GET /guest/{token}/overview — khách xem tổng quan tiến độ read-only qua token */
export async function fetchGuestOverview(token: string): Promise<GuestOverviewDto> {
  const data = await apiRequest<BackendGuestOverviewResponse>('GET', `/guest/${token}/overview`)
  return mapGuestOverviewResponse(data)
}

/** POST /guest/{token}/feedback — khách gửi nhận xét 1 chiều qua token */
export async function submitGuestFeedback(
  token: string,
  cmd: SubmitGuestFeedbackCommand | CreateGuestFeedbackCommandDto,
): Promise<GuestFeedbackDto> {
  const body = {
    reviewerName: cmd.reviewerName || 'Khách truy cập',
    reviewerRole: cmd.reviewerRole || 'GUEST',
    content: cmd.content ?? cmd.message ?? '',
    nodeId: cmd.nodeId != null ? Number(cmd.nodeId) : null,
  }
  const data = await apiRequest<any>('POST', `/guest/${token}/feedback`, { body })
  return mapGuestFeedbackResponse(data)
}
