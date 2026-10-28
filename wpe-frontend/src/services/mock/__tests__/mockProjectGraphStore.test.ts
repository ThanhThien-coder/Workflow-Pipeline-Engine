// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  convertTemplateToProjectGraph,
  cloneTemplateToProject,
  getStoredProjectGraph,
  updatePhasePositionInProject,
} from '../mockProjectGraphStore'
import { MACRO_CARD_W, MACRO_CARD_H, MACRO_GAP_X, MACRO_GAP_Y } from '../../../utils/macroLayout'
import type { GraphDataPayload } from '../../../types/template.types'

describe('mockProjectGraphStore: Auto-Layout on Template Creation', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('automatically calculates clean non-overlapping layout when converting a template with complex branching', () => {
    const mockGraphData: GraphDataPayload = {
      schemaVersion: 2,
      phases: [
        { id: 'ph_1', rootNodeId: 'nd_1', name: 'Foundation', order: 0, uiMetadata: { position: { x: 40, y: 60 } } },
        { id: 'ph_2', rootNodeId: 'nd_2', name: 'Phase 5', order: 1, uiMetadata: { position: { x: 300, y: 150 } } },
        { id: 'ph_3', rootNodeId: 'nd_3', name: 'Phase 7', order: 2, uiMetadata: { position: { x: 300, y: 200 } } },
        { id: 'ph_4', rootNodeId: 'nd_4', name: 'Phase 4', order: 3, uiMetadata: { position: { x: 550, y: 150 } } },
        { id: 'ph_5', rootNodeId: 'nd_5', name: 'Phase 5 Sub', order: 4, uiMetadata: { position: { x: 300, y: 250 } } },
        { id: 'ph_6', rootNodeId: 'nd_6', name: 'Phase 6', order: 5, uiMetadata: { position: { x: 600, y: 150 } } },
        { id: 'ph_7', rootNodeId: 'nd_7', name: 'Phase 7 Sub', order: 6, uiMetadata: { position: { x: 300, y: 300 } } },
        { id: 'ph_8', rootNodeId: 'nd_8', name: 'Phase 8', order: 7, uiMetadata: { position: { x: 300, y: 350 } } },
      ],
      phaseEdges: [
        { parentPhaseId: 'ph_1', childPhaseId: 'ph_2' },
        { parentPhaseId: 'ph_1', childPhaseId: 'ph_3' },
        { parentPhaseId: 'ph_3', childPhaseId: 'ph_4' },
        { parentPhaseId: 'ph_4', childPhaseId: 'ph_6' },
        { parentPhaseId: 'ph_2', childPhaseId: 'ph_5' },
        { parentPhaseId: 'ph_5', childPhaseId: 'ph_7' },
        { parentPhaseId: 'ph_7', childPhaseId: 'ph_8' },
      ],
      nodes: [],
      edges: [],
      metadata: { version: '1.0' },
    }

    const result = convertTemplateToProjectGraph(mockGraphData, 'Test Auto-Layout Pipeline')

    expect(result.phases).toHaveLength(8)

    // Check dimensions match macro cards
    result.phases.forEach((p) => {
      expect(p.w).toBe(MACRO_CARD_W)
      expect(p.h).toBe(MACRO_CARD_H)
    })

    // Verify vertical spacing: no two cards in the same column overlap
    const cols = new Map<number, typeof result.phases>()
    result.phases.forEach((p) => {
      const colKey = Math.round((p.x - 40) / (MACRO_CARD_W + MACRO_GAP_X))
      if (!cols.has(colKey)) cols.set(colKey, [])
      cols.get(colKey)!.push(p)
    })

    cols.forEach((phasesInCol) => {
      phasesInCol.sort((a, b) => a.y - b.y)
      for (let i = 1; i < phasesInCol.length; i++) {
        const prev = phasesInCol[i - 1]
        const curr = phasesInCol[i]
        const actualGap = curr.y - (prev.y + MACRO_CARD_H)
        expect(actualGap).toBeGreaterThanOrEqual(MACRO_GAP_Y)
      }
    })

    // Verify horizontal spacing: phases in different columns have at least MACRO_GAP_X
    const colKeys = Array.from(cols.keys()).sort((a, b) => a - b)
    for (let i = 1; i < colKeys.length; i++) {
      const prevColX = 40 + colKeys[i - 1] * (MACRO_CARD_W + MACRO_GAP_X)
      const currColX = 40 + colKeys[i] * (MACRO_CARD_W + MACRO_GAP_X)
      expect(currColX - (prevColX + MACRO_CARD_W)).toBeGreaterThanOrEqual(MACRO_GAP_X)
    }
  })

  it('preserves saved positions upon reopening and does NOT re-arrange on subsequent visits', () => {
    const projectId = 'test-proj-preserve-999'

    // Clone a template to project
    const created = cloneTemplateToProject(projectId, 'tpl-sdlc', 'Preserve Layout Test')
    expect(created).not.toBeNull()

    const initialPhasePositions = created!.phases.map((p) => ({ id: p.id, x: p.x, y: p.y }))

    // User manually drags Phase 1 to a custom position
    const customX = 999
    const customY = 888
    const targetPhaseId = created!.phases[0].id
    updatePhasePositionInProject(projectId, targetPhaseId, { x: customX, y: customY })

    // Simulate reopening project later: getStoredProjectGraph
    const reloaded = getStoredProjectGraph(projectId)
    expect(reloaded).not.toBeNull()

    const reloadedPhase = reloaded!.phases.find((p) => p.id === targetPhaseId)
    expect(reloadedPhase?.x).toBe(customX)
    expect(reloadedPhase?.y).toBe(customY)

    // Other phases remain exactly at their positions without being reset
    for (let i = 1; i < initialPhasePositions.length; i++) {
      const initial = initialPhasePositions[i]
      const current = reloaded!.phases.find((p) => p.id === initial.id)
      expect(current?.x).toBe(initial.x)
      expect(current?.y).toBe(initial.y)
    }
  })
})
