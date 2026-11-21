import type {
  GuestArtifactKind,
  GuestMemberRole,
  GuestReportDto,
  GuestReportMemberDto,
  GuestReportNodeDto,
} from '../types/guest.types'
import type { NodeStatus, PhaseStatus } from '../types/workflow.types'

/**
 * Nền tính toán số liệu cho trang khách mới (G3).
 *
 * Hàm thuần: không import React, không đọc store, không dùng Date.now().
 * Mọi phép tính ngày cố định theo giờ Việt Nam (UTC+7) để không lệch theo múi giờ máy chạy.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 86_400_000

export interface GuestTask {
  id: string
  code: string
  title: string
  description: string
  status: NodeStatus
  phaseId: string | null
  assigneeId: string | null
  due: Date | null
  created: Date
  started: Date | null
  done: Date | null
  reopened: boolean
  deps: string[]
  dependents: string[]
  waitingOn: string[]
  blocks: string[]
}

export type GuestVerdictTone = 'emerald' | 'orange' | 'rose' | 'blue' | 'slate'

export interface GuestPhaseVerdict {
  label: string
  tone: GuestVerdictTone
  diff?: number
}

export interface GuestReportPhase {
  id: string
  index: number
  name: string
  tasks: GuestTask[]
  done: number
  pct: number
  status: PhaseStatus
  overdue: number
  late: number
  plannedEnd: Date | null
  start: Date | null
  end: Date | null
  verdict: GuestPhaseVerdict
  onTimePct: number | null
  parentIds: string[]
}

export interface GuestReportBreakdown {
  DONE: number
  LATE: number
  REVIEW: number
  IN_PROGRESS: number
  TODO: number
  LOCKED: number
}

export interface GuestLateDoneItem {
  task: GuestTask
  lateBy: number
}

export interface GuestAttentionItem {
  task: GuestTask
  kind: 0 | 1 | 2
  text: string
}

export interface GuestReportMetrics {
  total: number
  done: number
  pct: number
  overdue: GuestTask[]
  blockedByOverdue: number
  onTime: number
  onTimeBase: number
  breakdown: GuestReportBreakdown
  lateDone: GuestLateDoneItem[]
  lateDays: number
  overdueDays: number
  missed: number
  reopened: number
  completed: boolean
  lastDueDate: Date | null
  finishedAt: Date | null
  currentPhase: GuestReportPhase | null
  attention: GuestAttentionItem[]
}

export interface GuestMember {
  id: string
  name: string
  role: GuestMemberRole | string
  initials: string
}

export interface GuestTeamMemberRow {
  member: GuestMember
  memberId: string
  total: number
  done: number
  onTime: number
  late: number
  worst: GuestLateDoneItem | null
  overdue: number
  active: number
  todo: number
  waiting: number
  onTimePct: number | null
}

export interface GuestTeamSummary {
  rows: GuestTeamMemberRow[]
  /** Task chưa xong mà chưa giao cho ai. */
  unassignedTasks: GuestTask[]
  /**
   * G39: dòng "Unassigned" tính như một thành viên, gồm mọi task không có người làm (kể cả đã xong).
   * null khi task nào cũng có người. Không nằm trong `rows` để luôn đứng cuối bảng.
   */
  unassignedRow: GuestTeamMemberRow | null
}

/** Thành viên giả cho dòng "Unassigned" ở bảng Who did what. */
export const UNASSIGNED_MEMBER: GuestMember = { id: '__unassigned__', name: 'Unassigned', role: 'UNASSIGNED', initials: '?' }

export type GuestBurnUpUnit = 'day' | 'week' | 'month'

export interface GuestBurnUpBucket {
  start: Date
  end: Date
  scope: number
  done: number | null
  finishedTasks: GuestTask[]
  future: boolean
}

export interface GuestBurnUp {
  unit: GuestBurnUpUnit
  buckets: GuestBurnUpBucket[]
}

export interface GuestArtifact {
  id: string
  name: string
  kind: GuestArtifactKind
  url: string | null
  host: string
  nodeId: string | null
  taskCode: string
  createdAt: Date
}

export interface GuestReportProject {
  name: string
  description: string
  status: string
  createdAt: Date
  linkExpiresAt: Date | null
}

export interface GuestReportModel {
  serverNow: Date
  project: GuestReportProject
  feedback: { total: number; resolved: number }
  tasks: GuestTask[]
  byId: Record<string, GuestTask>
  phases: GuestReportPhase[]
  realPhaseCount: number
  metrics: GuestReportMetrics
  members: GuestMember[]
  membersById: Record<string, GuestMember>
  team: GuestTeamSummary
  burnUp: GuestBurnUp
  artifacts: GuestArtifact[]
}

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Mốc 00:00:00.000 theo giờ Việt Nam (UTC+7) của ngày chứa `date`.
 * Cố định theo UTC+7, không phụ thuộc múi giờ của máy chạy code hoặc test.
 */
export function vnDay(date: Date | string | number): Date {
  const d = date instanceof Date ? date : new Date(date)
  const vnMs = d.getTime() + VN_OFFSET_MS
  const dayStartUtcMs = Math.floor(vnMs / DAY_MS) * DAY_MS
  return new Date(dayStartUtcMs - VN_OFFSET_MS)
}

/**
 * Số ngày lịch Việt Nam (UTC+7) từ `a` tới `b` (dương nếu `b` sau `a`).
 */
export function daysBetween(a: Date | string | number, b: Date | string | number): number {
  return Math.round((vnDay(b).getTime() - vnDay(a).getTime()) / DAY_MS)
}

/**
 * Chép đúng luật nhận diện của `ArtifactService.detectArtifactType` ở backend.
 * Frontend tự suy ra từ URL vì cột `type` backend lưu có thể sai.
 */
export function detectArtifactKind(url: string | null | undefined): GuestArtifactKind {
  if (!url) return 'OTHER_LINK'
  const lower = url.trim().toLowerCase()

  if (lower.includes('figma.com')) {
    return 'FIGMA'
  }
  if (lower.includes('github.com') || lower.includes('gitlab.com')) {
    return 'PR'
  }
  if (lower.includes('swagger') || lower.includes('openapi') || lower.includes('/api-docs')) {
    return 'SWAGGER'
  }
  if (
    lower.includes('docs.google.com') ||
    lower.includes('drive.google.com') ||
    lower.includes('notion.so') ||
    lower.includes('wiki')
  ) {
    return 'DOCS'
  }

  return 'OTHER_LINK'
}

function sanitizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return trimmed
  } catch {
    return null
  }
}

function extractHost(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'link'
  } catch {
    return 'link'
  }
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function normalizeStatus(status: string | null | undefined): NodeStatus {
  if (status === 'DONE' || status === 'REVIEW' || status === 'IN_PROGRESS' || status === 'TODO' || status === 'LOCKED') {
    return status
  }
  return 'LOCKED'
}

function dueSortMs(t: GuestTask): number {
  return t.due ? t.due.getTime() : Number.POSITIVE_INFINITY
}

function vnBucketStart(date: Date, unit: GuestBurnUpUnit): Date {
  const day = vnDay(date)
  if (unit === 'day') return day
  const shifted = new Date(day.getTime() + VN_OFFSET_MS)
  if (unit === 'week') {
    const offset = (shifted.getUTCDay() + 6) % 7
    shifted.setUTCDate(shifted.getUTCDate() - offset)
  } else {
    shifted.setUTCDate(1)
  }
  return new Date(shifted.getTime() - VN_OFFSET_MS)
}

function nextVnBucketStart(bucketStart: Date, unit: GuestBurnUpUnit): Date {
  const shifted = new Date(bucketStart.getTime() + VN_OFFSET_MS)
  if (unit === 'day') shifted.setUTCDate(shifted.getUTCDate() + 1)
  else if (unit === 'week') shifted.setUTCDate(shifted.getUTCDate() + 7)
  else shifted.setUTCMonth(shifted.getUTCMonth() + 1)
  return new Date(shifted.getTime() - VN_OFFSET_MS)
}

function buildBurnUp(
  tasks: GuestTask[],
  projectCreatedAt: Date,
  serverNow: Date,
  completed: boolean,
  lastDueDate: Date | null,
  finishedAt: Date | null,
): GuestBurnUp {
  const createdTimes = tasks.map((t) => t.created.getTime())
  const first = vnDay(new Date(Math.min(projectCreatedAt.getTime(), ...createdTimes)))

  // Chạy tới mốc muộn hơn giữa kế hoạch và thực tế để thấy phần kéo dài sau hạn.
  // Nếu thiếu dueDate/finishedAt thì neo vào serverNow để tránh mốc ngày rỗng.
  const endCandidates = [lastDueDate, completed ? finishedAt : serverNow]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime())
  const end = endCandidates.length > 0 ? new Date(Math.max(...endCandidates)) : serverNow

  const span = Math.max(0, daysBetween(first, end))
  const unit: GuestBurnUpUnit = span < 14 ? 'day' : span <= 26 * 7 ? 'week' : 'month'

  const startBucket = vnBucketStart(first, unit)
  const buckets: GuestBurnUpBucket[] = []

  for (let c = startBucket; c.getTime() <= end.getTime(); c = nextVnBucketStart(c, unit)) {
    const nextStart = nextVnBucketStart(c, unit)
    const bucketEnd = new Date(nextStart.getTime() - 1)
    const past = c.getTime() <= serverNow.getTime()
    const cut = bucketEnd.getTime() < serverNow.getTime() ? bucketEnd : serverNow

    const finishedTasks = past
      ? tasks.filter((t) => t.done !== null && t.done.getTime() >= c.getTime() && t.done.getTime() <= cut.getTime())
      : []

    buckets.push({
      start: c,
      end: bucketEnd,
      scope: tasks.filter((t) => t.created.getTime() <= bucketEnd.getTime()).length,
      done: past ? tasks.filter((t) => t.done !== null && t.done.getTime() <= cut.getTime()).length : null,
      finishedTasks,
      future: !past,
    })
  }

  return { unit, buckets }
}

/**
 * Chuyển dữ liệu thô từ backend (`GuestReportDto`) thành mô hình số liệu đầy đủ cho trang khách mới.
 */
export function buildGuestReport(dto: GuestReportDto): GuestReportModel {
  const serverNow = toValidDate(dto.serverNow) ?? new Date(0)
  const today0Ms = vnDay(serverNow).getTime()
  const projectCreatedAt = toValidDate(dto.project?.createdAt) ?? serverNow

  const rawPhases = [...(dto.graph?.phases ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
  const knownPhaseIds = new Set(rawPhases.map((p) => String(p.id)))

  const rawNodes: GuestReportNodeDto[] = dto.graph?.nodes ?? []
  const byId: Record<string, GuestTask> = {}
  const tasks: GuestTask[] = rawNodes.map((n) => {
    const id = String(n.id)
    const rawPhaseId = n.phaseId != null ? String(n.phaseId) : null
    const phaseId = rawPhaseId && knownPhaseIds.has(rawPhaseId) ? rawPhaseId : null
    const created = toValidDate(n.createdAt) ?? projectCreatedAt
    const task: GuestTask = {
      id,
      code: n.code,
      title: n.title,
      description: n.description ?? '',
      status: normalizeStatus(n.status),
      phaseId,
      assigneeId: n.assignedUserId != null ? String(n.assignedUserId) : null,
      due: toValidDate(n.dueDate),
      created,
      started: toValidDate(n.startedAt),
      done: toValidDate(n.completedAt),
      reopened: Boolean(n.reopenedAt),
      deps: [],
      dependents: [],
      waitingOn: [],
      blocks: [],
    }
    byId[id] = task
    return task
  })

  for (const dep of dto.graph?.dependencies ?? []) {
    const parentId = String(dep.parentNodeId)
    const childId = String(dep.childNodeId)
    const parent = byId[parentId]
    const child = byId[childId]
    if (!parent || !child) continue
    if (!child.deps.includes(parentId)) child.deps.push(parentId)
    if (!parent.dependents.includes(childId)) parent.dependents.push(childId)
  }

  for (const t of tasks) {
    t.waitingOn = t.deps.filter((dId) => byId[dId] && byId[dId].status !== 'DONE')

    if (t.status === 'DONE') {
      t.blocks = []
      continue
    }
    const seen = new Set<string>()
    const stack = [...t.dependents]
    while (stack.length > 0) {
      const currId = stack.pop()!
      if (currId === t.id || seen.has(currId)) continue
      seen.add(currId)
      const curr = byId[currId]
      if (curr) stack.push(...curr.dependents)
    }
    t.blocks = [...seen]
      .filter((cId) => byId[cId] && byId[cId].status !== 'DONE')
      .sort((a, b) => byId[a].code.localeCompare(byId[b].code))
  }

  // Thiếu dueDate: task không bao giờ quá hạn, không tính trễ, không tính vào onTime/onTimeBase.
  const isOverdue = (t: GuestTask): boolean =>
    t.status !== 'DONE' && t.due !== null && vnDay(t.due).getTime() < today0Ms

  // Task DONE mà thiếu completedAt: không đủ dữ liệu để tính trễ hay đúng hạn, nên bỏ qua ở cả lateBy và isOnTime.
  const lateBy = (t: GuestTask): number => {
    if (t.status !== 'DONE' || t.due === null || t.done === null) return 0
    return daysBetween(t.due, t.done)
  }

  const isLateDone = (t: GuestTask): boolean => lateBy(t) > 0

  const isOnTime = (t: GuestTask): boolean =>
    t.status === 'DONE' && t.due !== null && t.done !== null && vnDay(t.done).getTime() <= vnDay(t.due).getTime()

  // Tập hợp thành viên: giữ thành viên từ backend, đồng thời tạo "Former member" cho assigneeId không còn trong danh sách.
  const membersById: Record<string, GuestMember> = {}
  const members: GuestMember[] = (dto.members ?? []).map((m: GuestReportMemberDto) => {
    const id = String(m.id)
    const member: GuestMember = {
      id,
      name: m.name,
      role: m.role,
      initials: computeInitials(m.name),
    }
    membersById[id] = member
    return member
  })

  for (const t of tasks) {
    if (t.assigneeId && !membersById[t.assigneeId]) {
      const former: GuestMember = {
        id: t.assigneeId,
        name: 'Former member',
        role: 'FORMER',
        initials: computeInitials('Former member'),
      }
      membersById[t.assigneeId] = former
      members.push(former)
    }
  }

  // Quan hệ giữa các phase: gộp từ parentPhaseIds và phaseEdges (đề phòng backend chỉ điền một trong hai).
  const phaseParentsMap: Record<string, string[]> = {}
  for (const p of rawPhases) {
    phaseParentsMap[String(p.id)] = (p.parentPhaseIds ?? []).map(String)
  }
  for (const edge of dto.graph?.phaseEdges ?? []) {
    if (!Array.isArray(edge) || edge.length < 2) continue
    const [parentId, childId] = [String(edge[0]), String(edge[1])]
    const list = phaseParentsMap[childId]
    if (list && !list.includes(parentId)) list.push(parentId)
  }

  type PhaseGroup = { id: string; name: string; index: number; parentIds: string[] }
  const groups: PhaseGroup[] = rawPhases.map((p, i) => ({
    id: String(p.id),
    name: p.name,
    index: i,
    parentIds: phaseParentsMap[String(p.id)] ?? [],
  }))

  const hasUnphased = tasks.some((t) => t.phaseId === null)
  if (hasUnphased) {
    groups.push({ id: 'none', name: 'No phase', index: -1, parentIds: [] })
  }

  const phases: GuestReportPhase[] = groups.map((g) => {
    const ts = tasks
      .filter((t) => (g.index === -1 ? t.phaseId === null : t.phaseId === g.id))
      .sort((a, b) => dueSortMs(a) - dueSortMs(b))

    const doneCount = ts.filter((t) => t.status === 'DONE').length
    let status: PhaseStatus = 'TODO'
    if (ts.length === 0) status = 'NO_TASKS'
    else if (doneCount === ts.length) status = 'COMPLETED'
    else if (ts.every((t) => t.status === 'LOCKED')) status = 'LOCKED'
    else if (ts.some((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'DONE')) {
      status = 'IN_PROGRESS'
    }

    const overdueN = ts.filter(isOverdue).length
    const lateN = ts.filter(isLateDone).length

    // plannedEnd chỉ xét task có dueDate; nếu mọi task đều thiếu dueDate thì plannedEnd = null.
    const dueTimes = ts.map((t) => t.due).filter((d): d is Date => d !== null).map((d) => d.getTime())
    const plannedEnd = dueTimes.length > 0 ? new Date(Math.max(...dueTimes)) : null

    // startedAt có thể rỗng ở dữ liệu cũ -> dùng fallback completedAt như mock.
    const startTimes = ts
      .map((t) => t.started ?? t.done)
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime())
    const start = startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null

    // Nếu phase đã có task IN_PROGRESS / REVIEW / DONE nhưng thiếu cả startedAt lẫn completedAt thì vẫn coi là đã bắt đầu.
    const hasStarted =
      start !== null || ts.some((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'DONE')

    // Task DONE thiếu completedAt không tính vào end/finishedAt.
    const doneTimes = ts
      .filter((t) => t.status === 'DONE')
      .map((t) => t.done)
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime())
    const end = ts.length > 0 && doneCount === ts.length && doneTimes.length > 0 ? new Date(Math.max(...doneTimes)) : null

    // onTime và onTimeBase chỉ tính trên task có dueDate (và đã có completedAt nếu DONE).
    const onTimeN = ts.filter(isOnTime).length
    const onTimeBase = ts.filter((t) => t.due !== null && ((t.status === 'DONE' && t.done !== null) || isOverdue(t))).length

    let verdict: GuestPhaseVerdict
    if (ts.length === 0) {
      verdict = { label: 'No tasks', tone: 'slate' }
    } else if (end !== null && plannedEnd !== null) {
      const diff = daysBetween(plannedEnd, end)
      verdict =
        diff <= 0
          ? { label: 'Finished on time', tone: 'emerald' }
          : { label: `Finished ${diff}d late`, tone: 'orange', diff }
    } else if (doneCount === ts.length) {
      // Phase đã DONE hết nhưng thiếu dueDate hoặc completedAt nên không tính được số ngày chênh lệch.
      verdict = { label: 'Completed', tone: 'emerald' }
    } else if (overdueN > 0) {
      verdict = { label: `Behind · ${overdueN} overdue`, tone: 'rose' }
    } else if (!hasStarted) {
      verdict = { label: 'Not started', tone: 'slate' }
    } else if (plannedEnd === null) {
      verdict = { label: 'In progress', tone: 'blue' }
    } else {
      verdict = { label: 'On track', tone: 'blue' }
    }

    return {
      id: g.id,
      index: g.index,
      name: g.name,
      tasks: ts,
      done: doneCount,
      pct: ts.length > 0 ? Math.round((doneCount / ts.length) * 100) : 0,
      status,
      overdue: overdueN,
      late: lateN,
      plannedEnd,
      start,
      end,
      verdict,
      onTimePct: onTimeBase > 0 ? Math.round((onTimeN / onTimeBase) * 100) : null,
      parentIds: g.parentIds,
    }
  })

  const realPhases = phases.filter((p) => p.index >= 0)
  const activeCount = (p: GuestReportPhase): number =>
    p.tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length

  let currentPhase: GuestReportPhase | null = null
  if (realPhases.length > 0) {
    const busiest = realPhases.reduce((best, p) => (activeCount(p) >= activeCount(best) ? p : best), realPhases[0])
    currentPhase =
      activeCount(busiest) > 0
        ? busiest
        : realPhases.find((p) => p.status !== 'COMPLETED') ?? realPhases[realPhases.length - 1]
  }

  const total = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'DONE')
  const overdue = tasks
    .filter(isOverdue)
    .sort((a, b) => b.blocks.length - a.blocks.length || dueSortMs(a) - dueSortMs(b))

  const holdUp = new Set(overdue.flatMap((t) => t.blocks))
  for (const t of overdue) holdUp.delete(t.id)

  const onTime = doneTasks.filter(isOnTime).length
  const onTimeBase = tasks.filter(
    (t) => t.due !== null && ((t.status === 'DONE' && t.done !== null) || isOverdue(t)),
  ).length

  const lateDone: GuestLateDoneItem[] = doneTasks
    .filter(isLateDone)
    .sort((a, b) => lateBy(b) - lateBy(a) || dueSortMs(a) - dueSortMs(b))
    .map((task) => ({ task, lateBy: lateBy(task) }))

  const countStatus = (s: NodeStatus): number => tasks.filter((t) => t.status === s).length
  const breakdown: GuestReportBreakdown = {
    DONE: countStatus('DONE') - lateDone.length,
    LATE: lateDone.length,
    REVIEW: countStatus('REVIEW'),
    IN_PROGRESS: countStatus('IN_PROGRESS'),
    TODO: countStatus('TODO'),
    LOCKED: countStatus('LOCKED'),
  }

  const overdueDays = overdue.reduce((s, t) => s + (t.due ? daysBetween(t.due, serverNow) : 0), 0)
  const lateDays = lateDone.reduce((s, item) => s + item.lateBy, 0)

  const allDueTimes = tasks.map((t) => t.due).filter((d): d is Date => d !== null).map((d) => d.getTime())
  const lastDueDate = allDueTimes.length > 0 ? new Date(Math.max(...allDueTimes)) : null

  const allDoneTimes = doneTasks.map((t) => t.done).filter((d): d is Date => d !== null).map((d) => d.getTime())
  const finishedAt = allDoneTimes.length > 0 ? new Date(Math.max(...allDoneTimes)) : null

  // Từ G34 dự án không còn trạng thái COMPLETED (chỉ DRAFT, ACTIVE, ARCHIVED), nên "đã xong" tính theo task:
  // có task và mọi task đều DONE. Thêm task mới thì tự trở lại đang làm.
  const completed = tasks.length > 0 && tasks.every((t) => t.status === 'DONE')
  const attention: GuestAttentionItem[] = []
  if (!completed) {
    for (const t of tasks) {
      if (t.status === 'DONE' || t.due === null) continue
      const left = daysBetween(serverNow, t.due)
      if (isOverdue(t)) {
        attention.push({
          task: t,
          kind: 0,
          text: `Overdue ${-left}d${t.assigneeId ? '' : ' · no assignee'}`,
        })
      } else if (left <= 2 && t.blocks.length > 0) {
        attention.push({
          task: t,
          kind: 1,
          text: left === 0 ? 'Due today' : `Due in ${left}d`,
        })
      } else if (!t.assigneeId && left <= 7) {
        attention.push({
          task: t,
          kind: 2,
          text: `No assignee · due in ${left}d`,
        })
      }
    }
    attention.sort((a, b) => a.kind - b.kind || b.task.blocks.length - a.task.blocks.length || dueSortMs(a.task) - dueSortMs(b.task))
  }

  // Một dòng của bảng Who did what, từ các task của một người (hoặc nhóm task chưa giao).
  const buildTeamRow = (member: GuestMember, ts: GuestTask[]): GuestTeamMemberRow => {
    const memberDone = ts.filter((t) => t.status === 'DONE')
    const memberLate = memberDone.filter(isLateDone)
    const memberOverdue = ts.filter(isOverdue).length
    const memberOnTime = memberDone.filter(isOnTime).length
    const memberOnTimeBase = ts.filter(
      (t) => t.due !== null && ((t.status === 'DONE' && t.done !== null) || isOverdue(t)),
    ).length
    const worstTask = memberLate.reduce<GuestTask | null>(
      (w, t) => (!w || lateBy(t) > lateBy(w) ? t : w),
      null,
    )

    return {
      member,
      memberId: member.id,
      total: ts.length,
      done: memberDone.length,
      onTime: memberOnTime,
      late: memberLate.length,
      worst: worstTask ? { task: worstTask, lateBy: lateBy(worstTask) } : null,
      overdue: memberOverdue,
      active: ts.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length,
      todo: ts.filter((t) => t.status === 'TODO').length,
      waiting: ts.filter((t) => t.status === 'LOCKED').length,
      onTimePct: memberOnTimeBase > 0 ? Math.round((memberOnTime / memberOnTimeBase) * 100) : null,
    }
  }

  // Bảng thành viên: bỏ VIEWER nếu không có task nào; FORMER vẫn giữ.
  const teamRows: GuestTeamMemberRow[] = members
    .map((member) => ({ member, ts: tasks.filter((t) => t.assigneeId === member.id) }))
    .filter(({ member, ts }) => !(String(member.role).toUpperCase() === 'VIEWER' && ts.length === 0))
    .map(({ member, ts }) => buildTeamRow(member, ts))
    .sort((a, b) => b.done - a.done || (b.onTimePct ?? -1) - (a.onTimePct ?? -1))

  const unassignedTasks = tasks.filter((t) => !t.assigneeId && t.status !== 'DONE')
  const allUnassigned = tasks.filter((t) => !t.assigneeId)
  const unassignedRow = allUnassigned.length > 0 ? buildTeamRow(UNASSIGNED_MEMBER, allUnassigned) : null

  const burnUp = buildBurnUp(tasks, projectCreatedAt, serverNow, completed, lastDueDate, finishedAt)

  const artifacts: GuestArtifact[] = (dto.artifacts ?? [])
    .map((a) => {
      const safeUrl = sanitizeHttpUrl(a.url)
      const nodeId = a.nodeId != null ? String(a.nodeId) : null
      return {
        id: String(a.id),
        name: a.name,
        kind: detectArtifactKind(safeUrl),
        url: safeUrl,
        host: extractHost(safeUrl),
        nodeId,
        taskCode: nodeId ? byId[nodeId]?.code ?? '' : '',
        createdAt: toValidDate(a.createdAt) ?? serverNow,
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    serverNow,
    project: {
      name: dto.project?.name ?? '',
      description: dto.project?.description ?? '',
      status: dto.project?.status ?? 'ACTIVE',
      createdAt: projectCreatedAt,
      linkExpiresAt: toValidDate(dto.project?.linkExpiresAt),
    },
    feedback: {
      total: dto.feedback?.total ?? 0,
      resolved: dto.feedback?.resolved ?? 0,
    },
    tasks,
    byId,
    phases,
    realPhaseCount: realPhases.length,
    metrics: {
      total,
      done: doneTasks.length,
      pct: total > 0 ? Math.round((doneTasks.length / total) * 100) : 0,
      overdue,
      blockedByOverdue: holdUp.size,
      onTime,
      onTimeBase,
      breakdown,
      lateDone,
      lateDays,
      overdueDays,
      missed: lateDone.length + overdue.length,
      reopened: tasks.filter((t) => t.reopened).length,
      completed,
      lastDueDate,
      finishedAt,
      currentPhase,
      attention,
    },
    members,
    membersById,
    team: {
      rows: teamRows,
      unassignedTasks,
      unassignedRow,
    },
    burnUp,
    artifacts,
  }
}
