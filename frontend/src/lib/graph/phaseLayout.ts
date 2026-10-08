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
