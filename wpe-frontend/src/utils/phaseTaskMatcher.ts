import type { KanbanTask } from '../types/kanban.types'

/**
 * Checks whether a KanbanTask belongs to a specific MacroPhase.
 * Normalizes phase ID / name to handle case differences (e.g. 'P2A' vs 'p2a')
 * and stripped punctuation (e.g. 'PHASE 2A' vs 'P2A' vs 'Phase 2A · Auth').
 */
export function isTaskInPhase(
  task: KanbanTask,
  phase: { id: string; name?: string } | null | undefined
): boolean {
  if (!task || !phase) return false

  const pId = phase.id.trim().toUpperCase()
  const tPhase = (task.phaseId || '').trim().toUpperCase()

  if (tPhase === pId) return true

  // Strip non-alphanumeric chars
  const cleanPId = pId.replace(/[^A-Z0-9]/g, '')
  const cleanTPhase = tPhase.replace(/[^A-Z0-9]/g, '')

  // Normalize 'PHASE2A' -> 'P2A' and 'PHASE1' -> 'P1'
  const normPId = cleanPId.replace(/^PHASE/, 'P')
  const normTPhase = cleanTPhase.replace(/^PHASE/, 'P')

  if (normPId && normTPhase && normPId === normTPhase) return true
  if (
    cleanPId &&
    cleanTPhase &&
    (cleanPId === cleanTPhase ||
      cleanTPhase.endsWith(cleanPId) ||
      cleanPId.endsWith(cleanTPhase))
  ) {
    return true
  }

  // Also match against phase.name if available (e.g. 'PHASE 1', 'PHASE 2A')
  if (phase.name) {
    const cleanPName = phase.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const normPName = cleanPName.replace(/^PHASE/, 'P')
    if (normPName === normTPhase || normPName === cleanTPhase) return true
    if (
      cleanPName === cleanTPhase ||
      cleanPName.endsWith(cleanTPhase) ||
      cleanTPhase.endsWith(cleanPName)
    ) {
      return true
    }
  }

  return false
}
