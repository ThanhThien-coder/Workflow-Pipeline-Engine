import type {
  GraphDataPayload,
  DagValidationResult,
  DagViolation,
} from '../../types/template.types';

/**
 * Pure function to execute Kahn's Topological Sort cycle detection.
 * Complexity: O(V + E)
 */
export function validateDag(
  vertices: string[],
  edges: [string, string][]
): { valid: boolean; violations: string[] } {
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
    return { valid: true, violations: [] };
  }

  // Nodes remaining with in-degree > 0 are part of or influenced by a cycle
  const violations = vertices.filter((v) => indeg[v] > 0);
  return { valid: false, violations };
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
