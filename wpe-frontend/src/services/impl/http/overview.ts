import { apiRequest } from '../../http/apiClient'
import type {
  ActivityAction,
  ActivityItem,
  AiDiagnosisEngine,
  AiDiagnosisMetrics,
  AiDiagnosisSource,
  AiDiagnosticInsight,
  AiDiagnosticReport,
  AiMetricsStatus,
  BreakdownStatus,
  DailyVelocity,
  GuestAccessState,
  FeedbackItem,
  OverviewData,
  OverviewMetrics,
  TaskStatusBreakdown,
  WeekdayLabel,
  WeeklyVelocity,
} from '../../../types/overview.types'
import type { ProjectSettingsDto } from '../../../types/settings.types'
import type {
  BackendDependencyDto,
  BackendGraphNodeDto,
  BackendGraphResponse,
} from '../../../types/workflow.types'
import { getSavedAvatar } from '../../../utils/avatarUtils'
import type { ProjectActivityItem } from './activity'
import { pluralize } from '../../../utils/pluralize'

export interface OverviewGraphNode extends BackendGraphNodeDto {
  isOverdue?: boolean | null
  updatedAt?: string | null
  completedAt?: string | null
}

export interface OverviewGraphResponse extends Omit<BackendGraphResponse, 'nodes'> {
  nodes?: OverviewGraphNode[] | null
}

export interface OverviewStatsResult {
  metrics: OverviewMetrics
  statusBreakdown: TaskStatusBreakdown
  velocity: WeeklyVelocity
}

const WEEKDAYS: readonly WeekdayLabel[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BREAKDOWN_META: ReadonlyArray<{
  status: BreakdownStatus
  label: string
  barClass: string
  dotClass: string
}> = [
  { status: 'DONE', label: 'Done', barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { status: 'IN_PROGRESS', label: 'In Progress', barClass: 'bg-blue-500', dotClass: 'bg-blue-500' },
  { status: 'TODO', label: 'To Do', barClass: 'bg-sky-400', dotClass: 'bg-sky-400' },
  { status: 'LOCKED', label: 'Locked', barClass: 'bg-slate-300', dotClass: 'bg-slate-300' },
]

const AVATAR_CLASSES = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
] as const

export async function safeFetchAiAnalysis(projectId: string | number): Promise<unknown> {
  try {
    return await apiRequest<unknown>('GET', `/projects/${projectId}/ai-analysis`)
  } catch {
    return null
  }
}

function isNodeOverdue(node: OverviewGraphNode, nowMs: number): boolean {
  if (node.status === 'DONE') return false
  if (typeof node.isOverdue === 'boolean') return node.isOverdue
  if (!node.dueDate) return false
  const dueMs = Date.parse(node.dueDate)
  return Number.isFinite(dueMs) && dueMs < nowMs
}

function computeCriticalPathLength(
  nodes: readonly OverviewGraphNode[],
  dependencies: readonly BackendDependencyDto[],
): number {
  if (nodes.length === 0) return 0

  const nodeIds = new Set(nodes.map((n) => String(n.id)))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const dist = new Map<string, number>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
    dist.set(id, 1)
  }

  for (const dep of dependencies) {
    const parentId = String(dep.parentNodeId)
    const childId = String(dep.childNodeId)
    if (parentId === childId || !nodeIds.has(parentId) || !nodeIds.has(childId)) continue
    adj.get(parentId)!.push(childId)
    inDegree.set(childId, (inDegree.get(childId) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  let maxLen = 1
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    const currentDist = dist.get(current) ?? 1
    if (currentDist > maxLen) maxLen = currentDist

    for (const next of adj.get(current) ?? []) {
      const candidate = currentDist + 1
      if (candidate > (dist.get(next) ?? 1)) {
        dist.set(next, candidate)
        if (candidate > maxLen) maxLen = candidate
      }
      const nextDeg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, nextDeg)
      if (nextDeg === 0) queue.push(next)
    }
  }

  return maxLen
}

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function computeWeeklyVelocity(nodes: readonly OverviewGraphNode[], nowMs: number): WeeklyVelocity {
  if (nodes.length === 0) {
    return {
      periodLabel: 'Last 7 days',
      days: [],
      hasData: false,
      unavailableNote: 'No tasks yet. The chart will appear once the pipeline has tasks.',
    }
  }

  const today = new Date(nowMs)
  const bucketCounts = new Map<string, number>()
  const buckets: Array<{ dateKey: string; day: WeekdayLabel }> = []

  for (let offset = 6; offset >= 0; offset--) {
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const dateKey = toLocalDateKey(targetDate)
    const day = WEEKDAYS[targetDate.getDay()]
    buckets.push({ dateKey, day })
    bucketCounts.set(dateKey, 0)
  }

  for (const node of nodes) {
    if (node.status !== 'DONE') continue
    const dateStr = node.completedAt || node.updatedAt
    if (!dateStr || typeof dateStr !== 'string') continue
    const timeMs = Date.parse(dateStr)
    if (!Number.isFinite(timeMs)) continue
    const key = toLocalDateKey(new Date(timeMs))
    if (bucketCounts.has(key)) {
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1)
    }
  }

  const maxTasks = Math.max(...buckets.map((b) => bucketCounts.get(b.dateKey) ?? 0), 0)
  const days: DailyVelocity[] = buckets.map((bucket) => {
    const tasks = bucketCounts.get(bucket.dateKey) ?? 0
    return {
      day: bucket.day,
      tasks,
      isPeak: maxTasks > 0 && tasks === maxTasks,
    }
  })

  return {
    periodLabel: 'Last 7 days',
    days,
    hasData: true,
  }
}

export function computeOverviewStats(
  graph: OverviewGraphResponse | null | undefined,
  nowMs = Date.now(),
): OverviewStatsResult {
  const nodes = graph?.nodes ?? []
  const dependencies = graph?.dependencies ?? []

  const totalNodes = nodes.length
  const completedNodes = nodes.filter((node) => node.status === 'DONE').length
  const completionRate = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0
  const overdueCount = nodes.filter((node) => isNodeOverdue(node, nowMs)).length
  const pendingReviewCount = nodes.filter((node) => node.status === 'REVIEW').length

  const blockingParentIds = new Set(dependencies.map((dep) => String(dep.parentNodeId)))
  const blockingReleaseCount = nodes.filter(
    (node) => node.status !== 'DONE' && blockingParentIds.has(String(node.id)),
  ).length

  const criticalPathNodes = computeCriticalPathLength(nodes, dependencies)

  const metrics: OverviewMetrics = {
    totalNodes,
    criticalPathNodes,
    completedNodes,
    completionRate,
    overdueCount,
    blockingReleaseCount,
    pendingReviewCount,
  }

  const statusBreakdown: TaskStatusBreakdown = {
    totalTasks: totalNodes,
    items: BREAKDOWN_META.map((meta) => {
      const taskCount = nodes.filter((node) => node.status === meta.status).length
      const percent = totalNodes > 0 ? Math.round((taskCount / totalNodes) * 100) : 0
      return {
        status: meta.status,
        label: meta.label,
        percent,
        taskCount,
        barClass: meta.barClass,
        dotClass: meta.dotClass,
      }
    }),
  }

  return {
    metrics,
    statusBreakdown,
    velocity: computeWeeklyVelocity(nodes, nowMs),
  }
}

const AI_SOURCE_LABELS: Record<AiDiagnosisSource, AiDiagnosisEngine> = {
  AI_SERVICE: 'Gemini',
  HEURISTIC_FALLBACK: 'Fallback analysis',
  MOCK: 'Sample data',
  MOCK_FALLBACK: 'Sample data',
  UNKNOWN: 'Unknown source',
}

const RATE_LIMIT_DEFAULT_WARNING = 'The AI service is rate-limited, so this result may not be the latest.'

const VALID_METRICS_STATUSES: ReadonlySet<string> = new Set([
  'STABLE_GREEN',
  'YELLOW_WARNING',
  'RED_ALERT',
  'INSUFFICIENT_DATA',
  'OVERDUE',
])

function readAiMetrics(record: Record<string, unknown>): AiDiagnosisMetrics | undefined {
  const m = record.metrics
  if (!m || typeof m !== 'object' || Array.isArray(m)) return undefined
  const raw = m as Record<string, unknown>

  const rawStatus = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : ''
  const status: AiMetricsStatus = VALID_METRICS_STATUSES.has(rawStatus)
    ? (rawStatus as AiMetricsStatus)
    : 'UNKNOWN'

  const readNumber = (val: unknown): number | null =>
    typeof val === 'number' && Number.isFinite(val) ? val : null

  return {
    status,
    driftScore: readNumber(raw.driftScore),
    completedLast7Days: readNumber(raw.completedLast7Days),
    overdueDays: readNumber(raw.overdueDays),
    remainingTasks: readNumber(raw.remainingTasks),
  }
}

/** Đọc `source`. Thiếu hoặc lạ thì 'UNKNOWN': không mặc định là Gemini để khỏi ghi dữ liệu giả thành AI thật. */
function readAiSource(record: Record<string, unknown>): AiDiagnosisSource {
  const raw = typeof record.source === 'string' ? record.source.trim().toUpperCase() : ''
  return raw in AI_SOURCE_LABELS ? (raw as AiDiagnosisSource) : 'UNKNOWN'
}

/** Gộp `warning` và `rateLimitWarning` (chuỗi, hoặc true thì dùng câu mặc định) thành một dòng. */
function readAiWarning(record: Record<string, unknown>): string | undefined {
  const parts: string[] = []
  if (typeof record.warning === 'string' && record.warning.trim()) parts.push(record.warning.trim())
  const rate = record.rateLimitWarning
  if (typeof rate === 'string' && rate.trim()) parts.push(rate.trim())
  else if (rate === true) parts.push(RATE_LIMIT_DEFAULT_WARNING)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function mapAiAnalysisToReport(raw: unknown, fallbackTimestamp: string): AiDiagnosticReport {
  const emptyReport: AiDiagnosticReport = {
    engine: AI_SOURCE_LABELS.UNKNOWN,
    source: 'UNKNOWN',
    generatedAt: fallbackTimestamp,
    insights: [],
    hasAnalysis: false,
    emptyMessage: 'No diagnosis yet',
  }

  if (!raw || typeof raw !== 'object') return emptyReport
  const record = raw as Record<string, unknown>
  if (record.hasAnalysis === false) return emptyReport

  const source = readAiSource(record)
  const origin = {
    engine: AI_SOURCE_LABELS[source],
    source,
    warning: readAiWarning(record),
    metrics: readAiMetrics(record),
    rootCauseNotes:
      typeof record.rootCauseNotes === 'string' && record.rootCauseNotes.trim()
        ? record.rootCauseNotes.trim()
        : undefined,
  }

  const analyzedAt =
    typeof record.analyzedAt === 'string' && record.analyzedAt
      ? record.analyzedAt
      : typeof record.generatedAt === 'string' && record.generatedAt
        ? record.generatedAt
        : fallbackTimestamp

  if (Array.isArray(record.insights) && record.insights.length > 0) {
    return {
      ...origin,
      generatedAt: analyzedAt,
      insights: record.insights as AiDiagnosticInsight[],
      hasAnalysis: true,
    }
  }

  const insights: AiDiagnosticInsight[] = []

  if (Array.isArray(record.bottlenecks)) {
    record.bottlenecks.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const b = item as Record<string, unknown>
      const severityRaw = String(b.severity ?? 'MEDIUM').toUpperCase()
      const isHigh = severityRaw === 'HIGH'
      const nodeCode = b.nodeCode ? String(b.nodeCode) : ''
      insights.push({
        id: `bottleneck-${index}`,
        kind: 'BOTTLENECK',
        severity: isHigh ? 'HIGH' : 'MEDIUM',
        icon: isHigh ? '🔴' : '🟡',
        kicker: 'Bottleneck detected',
        tag: severityRaw,
        title: String(b.title || nodeCode || 'Bottleneck'),
        description: String(b.reason || ''),
        relatedNodeIds: nodeCode ? [nodeCode] : [],
        boxClass: isHigh ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
        tagClass: isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      })
    })
  }

  if (Array.isArray(record.taskTraps)) {
    record.taskTraps.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const t = item as Record<string, unknown>
      const nodeCode = t.nodeCode ? String(t.nodeCode) : ''
      insights.push({
        id: `trap-${index}`,
        kind: 'CRITICAL_PATH',
        severity: 'MEDIUM',
        icon: '🟡',
        kicker: String(t.trapType || 'Critical Path Risk'),
        tag: 'Risk',
        title: String(t.title || nodeCode || 'Task trap'),
        description: String(t.suggestion || ''),
        relatedNodeIds: nodeCode ? [nodeCode] : [],
        boxClass: 'bg-amber-50 border-amber-200',
        tagClass: 'bg-amber-100 text-amber-800',
      })
    })
  }

  if (Array.isArray(record.actionableAdvice)) {
    record.actionableAdvice.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const a = item as Record<string, unknown>
      const targetCode = a.targetNodeCode ? String(a.targetNodeCode) : ''
      const action = a.action ? String(a.action) : 'Recommendation'
      insights.push({
        id: `advice-${index}`,
        kind: 'RECOMMENDATION',
        severity: 'ADVICE',
        icon: '🟢',
        kicker: source === 'HEURISTIC_FALLBACK' ? 'Recommended action' : 'AI Actionable Advice',
        tag: String(a.priority || 'Advice'),
        title: targetCode && targetCode !== 'GENERAL' ? `${action} · ${targetCode}` : action,
        description: String(a.instruction || ''),
        relatedNodeIds: targetCode && targetCode !== 'GENERAL' ? [targetCode] : [],
        boxClass: 'bg-emerald-50 border-emerald-200',
        tagClass: 'bg-emerald-100 text-emerald-700',
      })
    })
  }

  if (insights.length === 0) return { ...emptyReport, ...origin }

  return {
    ...origin,
    generatedAt: analyzedAt,
    insights,
    hasAnalysis: true,
  }
}

function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SY'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function toActivityAction(type: string): ActivityAction {
  switch (type) {
    case 'ARTIFACT_SUBMITTED':
      return 'SUBMITTED_PR'
    case 'INVITATION_EXPIRED':
      return 'OVERDUE_ALERT'
    case 'PROJECT_CREATED':
    case 'PROJECT_STATUS_CHANGED':
    case 'MEMBER_JOINED':
    case 'INVITATION_ACCEPTED':
      return 'APPROVED'
    default:
      return 'CLAIMED'
  }
}

function pickAvatarClass(seed: string): string {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return AVATAR_CLASSES[sum % AVATAR_CLASSES.length]
}

export function mapProjectActivities(items: readonly ProjectActivityItem[]): ActivityItem[] {
  return items.map((item) => {
    const actorName = item.actorName || 'System'
    return {
      id: item.id,
      actor: {
        id: item.actorId ?? null,
        name: actorName,
        initials: toInitials(actorName),
        avatarClass: pickAvatarClass(actorName),
        avatarUrl: item.actorAvatarUrl || getSavedAvatar(actorName),
      },
      action: toActivityAction(item.type),
      message: item.message,
      nodeCode: item.targetCode ?? '',
      occurredAt: item.createdAt,
    }
  })
}

export function formatPhaseLabel(status: string, phaseCount: number): string {
  const statusMap: Record<string, string> = {
    DRAFT: 'Draft',
    PLANNING: 'Planning',
    ACTIVE: 'Published',
    PAUSED: 'Paused',
    INACTIVE: 'Paused',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
  }
  const statusLabel = statusMap[status] || status || 'Active'
  if (phaseCount > 0) {
    return `${pluralize(phaseCount, 'phase')} · ${statusLabel}`
  }
  return statusLabel
}

export interface BuildOverviewInput {
  settings: ProjectSettingsDto
  graph: OverviewGraphResponse
  activities: ProjectActivityItem[]
  feedbackQueue: FeedbackItem[]
  aiRaw: unknown
  guestAccess: GuestAccessState
  nowMs?: number
}

export function buildOverviewData(input: BuildOverviewInput): OverviewData {
  const nowMs = input.nowMs ?? Date.now()
  const stats = computeOverviewStats(input.graph, nowMs)
  const lastUpdatedAt = input.settings.updatedAt || input.settings.createdAt || new Date(nowMs).toISOString()

  return {
    project: {
      id: input.settings.id,
      name: input.settings.name,
      role: input.settings.myRole,
      phaseLabel: formatPhaseLabel(input.settings.status, input.graph.phases?.length ?? 0),
      lastUpdatedAt,
    },
    metrics: stats.metrics,
    velocity: stats.velocity,
    statusBreakdown: stats.statusBreakdown,
    aiReport: mapAiAnalysisToReport(input.aiRaw, lastUpdatedAt),
    guestAccess: input.guestAccess,
    feedbackQueue: input.feedbackQueue,
    recentActivity: mapProjectActivities(input.activities),
  }
}
