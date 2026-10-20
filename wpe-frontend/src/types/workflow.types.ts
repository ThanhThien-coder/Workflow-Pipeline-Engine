export type NodeStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type JoinPolicy = 'ALL_COMPLETED' | 'ANY_COMPLETED'
export type PhaseStatus = 'COMPLETED' | 'IN_PROGRESS' | 'TODO' | 'LOCKED'
export type PhaseAccent = 'emerald' | 'blue' | 'slate'

interface GraphNodeBase {
  id: string
  parentIds: string[]
  title: string
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface RootGraphNode extends GraphNodeBase {
  kind: 'root'
}

export interface BranchGraphNode extends GraphNodeBase {
  kind: 'branch'
  code: string
  description: string
  isTrack: boolean
  status: NodeStatus
  progress?: number
  assignee: string | null
  due: string | null
  blocker: string | null
  joinPolicy: JoinPolicy | 'AND' | null
  phaseId?: string
  trackId?: string | null
  parentId?: string | null
  level?: number
  order?: number
  column?: number
  row?: number
  x?: number
  y?: number
  width?: number
  height?: number
}

export type TaskStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'

export interface GhostDependency {
  id: string               // e.g. "ghost_p1_db"
  sourcePhaseId: string    // e.g. "phase_01"
  sourcePhaseTitle: string // e.g. "Phase 1: Foundation"
  sourceTaskId: string     // e.g. "task_db_schema"
  sourceTaskTitle: string  // e.g. "Core DB Schema"
  targetTaskId: string     // The task in the current phase that depends on this ghost
  status: TaskStatus
}

export interface PhaseNode {
  id: string
  title: string
  status: TaskStatus
  progress?: number
  assignee?: { name: string; avatarUrl: string; initials: string }
  parentId?: string | null // Track ID or Root ID
  dependencies?: string[]  // Internal dependencies
  ghostPrerequisites?: GhostDependency[] // Ghost nodes anchored to this task
}

export interface GhostGraphNode extends GraphNodeBase {
  kind: 'ghost'
  refPhase: string
  refId: string
  dir: 'up' | 'down'
  targetTaskId?: string
  status?: TaskStatus
  sourcePhaseTitle?: string
  sourceTaskTitle?: string
}

export type GraphNode = RootGraphNode | BranchGraphNode | GhostGraphNode
export type GraphNodeMap = Record<string, GraphNode>
export type PhaseTreeData = GraphNodeMap

export interface MacroPhase {
  id: string
  name: string
  sub: string
  status: PhaseStatus
  pct: number
  accent: PhaseAccent
  x: number
  y: number
  w: number
  h: number
  parentPhaseIds: string[]
  locked?: boolean
}

export interface Gate {
  prLink: string | null
  prMerged: boolean
  swagger: string
}

export interface PhaseTree {
  title: string
  breadcrumb: string
  pct: number
  gate: Gate
  nodes: GraphNodeMap
}
