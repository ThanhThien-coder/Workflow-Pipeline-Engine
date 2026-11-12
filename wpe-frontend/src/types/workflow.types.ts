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

// ───────────── Dữ liệu phẳng backend trả về (GET /projects/{id}/graph, B2) ─────────────
// Chỉ dùng ở lớp gọi API (services/impl/http/graph.ts) và mapper (mappers/graphMapper.ts).
// Component không đọc trực tiếp các kiểu này.

export interface BackendPhaseDto {
  id: string | number
  name: string
  sub?: string | null
  accent?: string | null
  orderIndex?: number | null
  parentPhaseIds?: Array<string | number> | null
  /** TODO | LOCKED | IN_PROGRESS | COMPLETED, backend suy ra từ task */
  status?: string | null
  progressPct?: number | null
  totalTasks?: number | null
  doneTasks?: number | null
  /** Vị trí thẻ phase trên canvas: { x, y, w, h }. {} nếu chưa từng kéo (V9, B2). */
  uiMetadata?: Record<string, unknown> | null
}

export interface BackendGraphNodeDto {
  id: string | number
  phaseId?: string | number | null
  code: string
  title: string
  description?: string | null
  status?: string | null
  joinPolicy?: string | null
  assignedUserId?: string | number | null
  dueDate?: string | null
  estimatedHours?: number | null
  version?: number | null
  uiMetadata?: {
    position?: { x?: number; y?: number }
    width?: number
    height?: number
    [key: string]: unknown
  } | null
}

export interface BackendDependencyDto {
  parentNodeId: string | number
  childNodeId: string | number
}

export interface BackendGraphResponse {
  phases?: BackendPhaseDto[] | null
  /** Mỗi phần tử là [phaseCha, phaseCon] */
  phaseEdges?: Array<Array<string | number>> | null
  nodes?: BackendGraphNodeDto[] | null
  dependencies?: BackendDependencyDto[] | null
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
