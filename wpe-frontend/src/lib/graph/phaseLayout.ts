import type { PhaseDto, PhaseEdgeDto } from '../../types/template.types';

export const PW = 260;
export const PHH = 128;
export const GXP = 110;
export const GYP = 40;

export interface PhaseLayoutResult {
  positions: Map<string, { x: number; y: number; level: number; row: number }>;
  width: number;
  height: number;
}

/**
 * Pure layout algorithm for Macro Phase Canvas.
 * Assigns columns according to topological depth and stacks phases in rows.
 */
export function calculatePhaseLayout(
  phases: PhaseDto[],
  edges: PhaseEdgeDto[]
): PhaseLayoutResult {
  const positions = new Map<string, { x: number; y: number; level: number; row: number }>();

  if (phases.length === 0) {
    return { positions, width: 0, height: 0 };
  }

  const phaseIds = phases.map((p) => p.id);
  const levels: Record<string, number> = {};
  for (const id of phaseIds) {
    levels[id] = 0;
  }

  // Bellman-Ford style topological leveling (capped at phases.length)
  for (let k = 0; k < phases.length; k++) {
    for (const edge of edges) {
      const from = edge.parentPhaseId;
      const to = edge.childPhaseId;
      if (
        levels[from] !== undefined &&
        levels[to] !== undefined &&
        levels[from] + 1 > levels[to] &&
        levels[from] < phases.length
      ) {
        levels[to] = levels[from] + 1;
      }
    }
  }

  const rowCounter: Record<number, number> = {};
  let maxLevel = 0;
  let maxRow = 0;

  for (const phase of phases) {
    const level = levels[phase.id] || 0;
    const row = rowCounter[level] || 0;
    rowCounter[level] = row + 1;

    maxLevel = Math.max(maxLevel, level);
    maxRow = Math.max(maxRow, row + 1);

    positions.set(phase.id, {
      x: level * (PW + GXP),
      y: row * (PHH + GYP),
      level,
      row,
    });
  }

  const width = (maxLevel + 1) * (PW + GXP) - GXP;
  const height = maxRow * (PHH + GYP) - GYP;

  return {
    positions,
    width: Math.max(width, PW),
    height: Math.max(height, PHH),
  };
}

/**
 * Pure function to compute the 1-based Topological Sort rank for each Phase in the DAG.
 * SSOT Rule: Phase Model/DTO only stores semantic name (e.g. "Phân tích yêu cầu", "Foundation").
 * The sequence badge (Phase 1, Phase 2, ...) is computed dynamically via Topological Sort
 * so that re-ordering, inserting, or deleting phases immediately adjusts all badges in real-time.
 */
export function computeTopologicalPhaseRanks(
  phases: PhaseDto[],
  edges: PhaseEdgeDto[]
): Map<string, number> {
  const ranks = new Map<string, number>();
  if (phases.length === 0) return ranks;

  const phaseIdSet = new Set(phases.map((p) => p.id));
  const indeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const p of phases) {
    indeg[p.id] = 0;
    adj[p.id] = [];
  }

  for (const edge of edges) {
    if (phaseIdSet.has(edge.parentPhaseId) && phaseIdSet.has(edge.childPhaseId)) {
      indeg[edge.childPhaseId] = (indeg[edge.childPhaseId] || 0) + 1;
      adj[edge.parentPhaseId].push(edge.childPhaseId);
    }
  }

  // Deterministic queue ordered by initial index
  const queue: string[] = phases
    .filter((p) => indeg[p.id] === 0)
    .map((p) => p.id);

  let rankCounter = 1;
  const visited = new Set<string>();

  while (queue.length > 0) {
    const u = queue.shift()!;
    visited.add(u);
    ranks.set(u, rankCounter++);

    for (const neighbor of adj[u]) {
      indeg[neighbor]--;
      if (indeg[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Graceful fallback for any phases that are part of cycles or unreachable
  for (const p of phases) {
    if (!ranks.has(p.id)) {
      ranks.set(p.id, rankCounter++);
    }
  }

  return ranks;
}
