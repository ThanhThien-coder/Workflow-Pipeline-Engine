import type {
  BackendGraphNodeDto,
  BackendGraphResponse,
  BackendPhaseDto,
  BranchGraphNode,
  GhostGraphNode,
  JoinPolicy,
  MacroPhase,
  NodeStatus,
  PhaseAccent,
  PhaseStatus,
  PhaseTreeData,
} from '../types/workflow.types'

/**
 * B5 — Đổi dữ liệu phẳng của backend (phases, nodes, dependencies) sang mô hình FE.
 *
 * Mẫu Mapper/Adapter: chỉ chỗ này biết hình dạng JSON của backend. Component và store
 * chỉ làm việc với MacroPhase và GraphNodeMap (Root/Branch/Ghost).
 * Hàm thuần: không gọi API, không đọc store, cùng đầu vào thì cùng đầu ra.
 *
 * Đầu ra giữ đúng như code cũ trong HttpWorkflowService (đặc tả B5: hiển thị không đổi),
 * thêm duy nhất một điểm: phase có uiMetadata.x/y (đã kéo thả, lưu qua PUT /phases/{id}) thì dùng vị trí đó.
 */

// Vị trí mặc định của thẻ phase khi chưa từng kéo: xếp ngang theo orderIndex (giữ như cũ)
const PHASE_DEFAULT_X0 = 60
const PHASE_DEFAULT_GAP_X = 360
const PHASE_DEFAULT_Y = 80
const PHASE_W = 260
const PHASE_H = 128

// Vị trí và kích thước mặc định của node khi backend chưa có uiMetadata (giữ như cũ)
const ROOT_X = 80
const ROOT_Y = 200
const NODE_DEFAULT_X = 280
const NODE_DEFAULT_Y = 180
const NODE_DEFAULT_W = 220
const NODE_DEFAULT_H = 90

/** Id của nút gốc (root) trong cây của một phase. */
export function rootIdOf(phaseId: string): string {
  return `root_${phaseId}`
}

/** Id của ghost node cho một cạnh phụ thuộc khác phase. */
export function ghostIdOf(parentNodeId: string, childNodeId: string): string {
  return `ghost_${parentNodeId}_to_${childNodeId}`
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toMacroPhase(p: BackendPhaseDto, idx: number): MacroPhase {
  const ui = p.uiMetadata ?? {}
  return {
    id: String(p.id),
    name: p.name,
    sub: p.sub || '',
    accent: (p.accent as PhaseAccent) || 'slate',
    // Backend tính sẵn tiến độ và trạng thái phase từ task (cùng công thức với domain/phaseProgress)
    status: (p.status || 'TODO') as PhaseStatus,
    pct: typeof p.progressPct === 'number' ? p.progressPct : 0,
    x: finiteNumber(ui.x) ?? PHASE_DEFAULT_X0 + (p.orderIndex ?? idx) * PHASE_DEFAULT_GAP_X,
    y: finiteNumber(ui.y) ?? PHASE_DEFAULT_Y,
    w: PHASE_W,
    h: PHASE_H,
    parentPhaseIds: (p.parentPhaseIds || []).map(String),
    locked: p.status === 'LOCKED',
  }
}

/** Danh sách thẻ phase cho canvas Macro. Đồ thị rỗng thì trả []. */
export function toMacroPhases(graph: BackendGraphResponse | null | undefined): MacroPhase[] {
  return (graph?.phases || []).map(toMacroPhase)
}

/** Một phase vừa tạo (POST /phases trả 1 PhaseResponse). x/y truyền vào ưu tiên hơn vị trí mặc định. */
export function toCreatedMacroPhase(p: BackendPhaseDto, pos?: { x?: number; y?: number }): MacroPhase {
  const parents = (p.parentPhaseIds || []).map(String)
  return {
    ...toMacroPhase({ ...p, uiMetadata: {} }, p.orderIndex ?? 0),
    // Phase mới chưa có task: hiển thị TODO, 0%, bị khóa nếu có phase cha (giữ như cũ)
    status: 'TODO',
    pct: 0,
    x: pos?.x ?? PHASE_DEFAULT_X0 + (p.orderIndex ?? 0) * PHASE_DEFAULT_GAP_X,
    y: pos?.y ?? PHASE_DEFAULT_Y,
    parentPhaseIds: parents,
    locked: parents.length > 0,
  }
}

/** Cạnh giữa các phase: [phaseCha, phaseCon]. Không có cạnh thì trả []. */
export function toPhaseEdges(graph: BackendGraphResponse | null | undefined): [string, string][] {
  return (graph?.phaseEdges || []).map(([from, to]) => [String(from), String(to)] as [string, string])
}

function toBranch(n: BackendGraphNodeDto, phaseId: string): BranchGraphNode {
  // Giữ như cũ: backend gửi trạng thái nào thì dùng trạng thái đó, thiếu thì coi là LOCKED
  const status = ((n.status as NodeStatus) || 'LOCKED') as NodeStatus
  const joinPolicy: JoinPolicy = n.joinPolicy === 'ANY_COMPLETED' ? 'ANY_COMPLETED' : 'ALL_COMPLETED'
  return {
    id: String(n.id),
    kind: 'branch',
    code: n.code,
    title: n.title,
    description: n.description || '',
    isTrack: false,
    status,
    assignee: n.assignedUserId ? String(n.assignedUserId) : null,
    due: n.dueDate ? n.dueDate.split('T')[0] : null,
    blocker: null,
    joinPolicy,
    phaseId,
    // Mọi node của phase treo dưới root (giữ như cũ, cạnh cùng phase chưa vẽ: xem "Điều chưa chắc" của B5)
    parentIds: [rootIdOf(phaseId)],
    x: n.uiMetadata?.position?.x ?? NODE_DEFAULT_X,
    y: n.uiMetadata?.position?.y ?? NODE_DEFAULT_Y,
    width: n.uiMetadata?.width ?? NODE_DEFAULT_W,
    height: n.uiMetadata?.height ?? NODE_DEFAULT_H,
  }
}

/**
 * Cây Root/Branch/Ghost của một phase.
 * - Root: chính phase đó (id `root_<phaseId>`).
 * - Branch: mỗi node có phaseId = phase này.
 * - Ghost: mỗi cạnh phụ thuộc có cha ở phase khác (parent.phaseId !== child.phaseId), gắn vào node con.
 * Không tìm thấy phase thì trả null để lớp gọi API quyết định báo lỗi gì.
 */
export function toPhaseTree(graph: BackendGraphResponse | null | undefined, phaseId: string): PhaseTreeData | null {
  const phases = graph?.phases || []
  const phase = phases.find((p) => String(p.id) === String(phaseId))
  if (!phase) return null

  const allNodes = graph?.nodes || []
  const phaseNodes = allNodes.filter((n) => String(n.phaseId) === String(phaseId))
  const phaseNodeIds = new Set(phaseNodes.map((n) => String(n.id)))

  const rootId = rootIdOf(phaseId)
  const tree: PhaseTreeData = {
    [rootId]: { id: rootId, kind: 'root', title: phase.name, parentIds: [], x: ROOT_X, y: ROOT_Y },
  }

  for (const n of phaseNodes) {
    tree[String(n.id)] = toBranch(n, String(phaseId))
  }

  for (const dep of graph?.dependencies || []) {
    const childId = String(dep.childNodeId)
    if (!phaseNodeIds.has(childId)) continue
    const parentNode = allNodes.find((n) => String(n.id) === String(dep.parentNodeId))
    if (!parentNode || String(parentNode.phaseId) === String(phaseId)) continue

    const ghostId = ghostIdOf(String(dep.parentNodeId), childId)
    const sourcePhase = phases.find((p) => String(p.id) === String(parentNode.phaseId))
    const ghost: GhostGraphNode = {
      id: ghostId,
      kind: 'ghost',
      // Giữ như cũ: cha không thuộc phase nào (node độc lập) thì refPhase = '1'. Xem "Điều chưa chắc" của B5.
      refPhase: String(parentNode.phaseId || '1'),
      refId: String(dep.parentNodeId),
      dir: 'up',
      targetTaskId: childId,
      title: parentNode.title || 'Upstream Prerequisite',
      parentIds: [],
      sourceTaskTitle: parentNode.title,
      sourcePhaseTitle: sourcePhase?.name,
    }
    tree[ghostId] = ghost
  }

  return tree
}
