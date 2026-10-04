export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type ProjectRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER'

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
}

export interface CreateProjectCommand {
  name: string
  desc: string
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
