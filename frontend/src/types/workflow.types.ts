export type NodeStatus = 'LOCKED' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type JoinPolicy = 'ALL_COMPLETED' | 'ANY_COMPLETED'
export type PhaseStatus = 'COMPLETED' | 'IN_PROGRESS' | 'TODO' | 'LOCKED'
export type PhaseAccent = 'emerald' | 'blue' | 'slate'

interface GraphNodeBase {
  id: string
  parentIds: string[]
  title: string
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
}

export interface GhostGraphNode extends GraphNodeBase {
  kind: 'ghost'
  refPhase: string
  refId: string
  dir: 'up' | 'down'
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
