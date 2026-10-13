export type GuestLinkErrorCode = 'INVALID' | 'EXPIRED' | 'REVOKED'

export class GuestLinkError extends Error {
  constructor(public readonly code: GuestLinkErrorCode) {
    super(code)
    this.name = 'GuestLinkError'
  }
}

export interface GuestLinkInfoDto {
  projectName: string
  ownerName: string
}

export interface GuestSessionDto {
  sessionId: string
  /** null = anonymous */
  displayName: string | null
}

export interface GuestVelocityPoint {
  day: string
  value: number
}

export type GuestStatusKey = 'done' | 'inProgress' | 'todo' | 'blocked'

export interface GuestStatusSlice {
  key: GuestStatusKey
  label: string
  count: number
}

export interface GuestActivityItem {
  id: string
  initials: string
  actor: string
  text: string
  ago: string
}

export interface GuestOverviewDto {
  projectName: string
  phaseLabel: string
  lastUpdated: string
  totalNodes: number
  criticalNodes: number
  completedNodes: number
  completionPct: number
  overdueCount: number
  blockingCount: number
  totalTasks: number
  velocity: readonly GuestVelocityPoint[]
  statusBreakdown: readonly GuestStatusSlice[]
  recentActivity: readonly GuestActivityItem[]
}

export interface GuestAiSummaryDto {
  content: string
  highlights: readonly string[]
  risks: readonly string[]
  generatedAt: string
}

export interface SubmitGuestFeedbackCommand {
  sessionId: string
  message: string
}

export interface GuestFeedbackDto {
  id: string
  author: string
  message: string
  createdAt: string
}