export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'PLANNING' | 'PAUSED' | 'COMPLETED'
export type ProjectRole = 'OWNER' | 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED'

export interface ProjectInvitation {
  id: string
  projectId: string
  projectName: string
  inviterName: string
  role: 'MANAGER' | 'COLLABORATOR' | 'VIEWER'
  status: InvitationStatus
  expiresAt: string
}

export interface MemberSummaryDto {
  id: number | string
  displayName: string
}

export interface ProjectSummaryDto {
  id: number | string
  name: string
  description: string
  status: ProjectStatus
  role: ProjectRole
  nodeCount: number
  criticalPathLength: number
  completionPercent: number
  updatedAt: string
  members: readonly MemberSummaryDto[]
  ownerId?: string
  ownerName?: string
  totalNodes?: number
  completedNodes?: number
  inProgressNodes?: number
  progressPercentage?: number
  createdAt?: string
}

export type Project = ProjectSummaryDto

export interface WorkPhaseSummaryDto {
  id: string
  name: string
  subTitle?: string
  accentColor?: string
  orderIndex: number
  nodeCount: number
}

export interface ProjectDetailDto {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  ownerId?: string
  ownerName?: string
  role?: ProjectRole
  totalNodes: number
  nodeCount?: number
  completedNodes: number
  inProgressNodes: number
  progressPercentage: number
  completionPercent?: number
  createdAt?: string
  updatedAt?: string
  latestAiAnalysis?: Record<string, unknown> | null
  phases?: readonly WorkPhaseSummaryDto[]
  members?: readonly MemberSummaryDto[]
}

export interface CloneTemplateCommand {
  templateId: string | number
  projectName: string
  description?: string
  visibility?: string
}

export interface CreateProjectCommand {
  name: string
  desc?: string
  description?: string
  templateId?: string
  visibility?: string
}

export type ProjectTone = 'indigo' | 'sky' | 'emerald' | 'violet' | 'amber' | 'slate'

export interface ProjectCardVm {
  id: number | string
  name: string
  desc: string
  status: ProjectStatus
  role: ProjectRole
  nodes: number
  crit: number
  done: number
  upd: string
  ts: number
  tone: ProjectTone
  icon: string
  roleLabel: string
  members: readonly string[]
}
