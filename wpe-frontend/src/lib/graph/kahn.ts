import type {
  GraphDataPayload,
  DagValidationResult,
  DagViolation,
} from '../../types/template.types';

/**
 * Kết quả kiểm DAG.
 * - `violations`: mọi node còn in-degree > 0 sau Kahn (nằm trên vòng **và** đứng sau vòng).
 *   Giữ nguyên nghĩa cũ vì khớp phần kiểm template của backend (`KahnDagService.validateSimpleDag`).
 * - `cycleNodes` (B6): chỉ node **nằm trên** vòng lặp (hoặc giữa 2 vòng), bỏ node chỉ đứng sau vòng.
 *   Khớp `cycleNodeCodes` của backend (`validateProjectDag`, B1) — đây là danh sách backend trả trong 422.
 *   Cả hai giữ thứ tự như trong `vertices`.
 */
export interface DagCheckResult {
  valid: boolean
  violations: string[]
  cycleNodes: string[]
}

/**
 * Bỏ dần các node "đứng sau" vòng lặp: trong tập node bị chặn, node không còn cạnh đi ra tới node
 * bị chặn nào thì không nằm trên vòng; bỏ nó rồi lặp lại. Phần còn lại là node trên vòng.
 * Cùng thuật toán với `KahnDagService.peelNodesBehindCycle` ở backend.
 */
function peelNodesBehindCycle(blocked: string[], adj: Record<string, string[]>): Set<string> {
  const blockedSet = new Set(blocked)
  const outDegree: Record<string, number> = {}
  const parents: Record<string, string[]> = {}
  for (const id of blocked) {
    outDegree[id] = 0
    parents[id] = []
  }
  for (const from of blocked) {
    for (const to of adj[from]) {
      if (blockedSet.has(to)) {
        outDegree[from]++
        parents[to].push(from)
      }
    }
  }

  const queue = blocked.filter((id) => outDegree[id] === 0)
  const remaining = new Set(blocked)
  while (queue.length > 0) {
    const removed = queue.shift()!
    remaining.delete(removed)
    for (const parent of parents[removed]) {
      outDegree[parent]--
      if (outDegree[parent] === 0) queue.push(parent)
    }
  }
  return remaining
}

/**
 * Pure function to execute Kahn's Topological Sort cycle detection.
 * Complexity: O(V + E)
 */
export function validateDag(
  vertices: string[],
  edges: [string, string][]
): DagCheckResult {
  const indeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  const vertexSet = new Set(vertices);

  for (const v of vertices) {
    indeg[v] = 0;
    adj[v] = [];
  }

  for (const [from, to] of edges) {
    // Only consider edges where both source and target belong to vertices set
    if (vertexSet.has(from) && vertexSet.has(to)) {
      indeg[to] = (indeg[to] || 0) + 1;
      adj[from].push(to);
    }
  }

  const queue: string[] = vertices.filter((v) => indeg[v] === 0);
  let visited = 0;

  while (queue.length > 0) {
    const u = queue.shift()!;
    visited++;
    for (const neighbor of adj[u]) {
      indeg[neighbor]--;
      if (indeg[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visited === vertices.length) {
    return { valid: true, violations: [], cycleNodes: [] };
  }

  // Nodes remaining with in-degree > 0 are part of or influenced by a cycle
  const violations = vertices.filter((v) => indeg[v] > 0);
  const onCycle = peelNodesBehindCycle(violations, adj);
  return { valid: false, violations, cycleNodes: violations.filter((v) => onCycle.has(v)) };
}

/**
 * Pure function to perform 2-level independent cycle validation:
 * Level 1: Phase-level DAG validation (phaseEdges)
 * Level 2: Node-level DAG validation in each Phase (tree parentId->id edges U cross DEPENDENCY edges)
 */
export function validateTemplateGraph(payload: GraphDataPayload): DagValidationResult {
  const violations: DagViolation[] = [];
  let totalCount = 0;
  let visitedCount = 0;

  // 1. Level 1: Macro Phase DAG
  const phaseIds = payload.phases.map((p) => p.id);
  totalCount += phaseIds.length;

  const phaseEdges: [string, string][] = payload.phaseEdges.map((e) => [
    e.parentPhaseId,
    e.childPhaseId,
  ]);

  const phaseResult = validateDag(phaseIds, phaseEdges);
  visitedCount += phaseIds.length - phaseResult.violations.length;

  if (!phaseResult.valid) {
    violations.push({
      scope: 'PHASE',
      nodeIds: phaseResult.violations,
    });
  }

  // 2. Level 2: Micro Node DAG within each Phase
  for (const phase of payload.phases) {
    const phaseNodes = payload.nodes.filter((n) => n.phaseId === phase.id);
    const nodeIds = phaseNodes.map((n) => n.id);
    totalCount += nodeIds.length;

    if (nodeIds.length === 0) {
      continue;
    }

    const nodeEdges: [string, string][] = [];

    // 2a. Implicit Tree edges (parentId -> id)
    for (const node of phaseNodes) {
      if (node.parentId && nodeIds.includes(node.parentId)) {
        nodeEdges.push([node.parentId, node.id]);
      }
    }

    // 2b. Explicit cross DEPENDENCY edges
    const dependencyEdges = payload.edges.filter(
      (e) =>
        e.kind === 'DEPENDENCY' &&
        nodeIds.includes(e.parentId) &&
        nodeIds.includes(e.childId)
    );

    for (const dep of dependencyEdges) {
      nodeEdges.push([dep.parentId, dep.childId]);
    }

    const nodeResult = validateDag(nodeIds, nodeEdges);
    visitedCount += nodeIds.length - nodeResult.violations.length;

    if (!nodeResult.valid) {
      violations.push({
        scope: 'NODE',
        phaseId: phase.id,
        nodeIds: nodeResult.violations,
      });
    }
  }

  return {
    valid: violations.length === 0,
    visitedCount,
    totalCount,
    violations,
  };
}
