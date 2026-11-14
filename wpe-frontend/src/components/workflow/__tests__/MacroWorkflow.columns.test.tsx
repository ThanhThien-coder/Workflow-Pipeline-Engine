// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MacroWorkflow } from '../MacroWorkflow'
import { workflowService } from '../../../services/container'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { columnX } from '../../../utils/phaseColumnLayout'
import type { MacroPhase } from '../../../types/workflow.types'

/** T5 (G3) — canvas: thẻ theo cột DAG, dây có mũi tên, rê chuột vào phase thì dây của nó nổi, dây khác mờ. */

function phase(id: string, parentPhaseIds: string[], pos?: { x: number; y: number }): MacroPhase {
  return { id, name: id.toUpperCase(), sub: '', status: 'TODO', pct: 0, accent: 'slate', w: 380, h: 180, parentPhaseIds, ...pos }
}

// c đã lưu x ở cột 0 (sai) nhưng là con của b (cột 1) → phải hiện ở cột 2
const PHASES = [phase('a', [], { x: 40, y: 60 }), phase('b', ['a']), phase('c', ['b'], { x: 40, y: 400 }), phase('d', ['a'])]
const EDGES: [string, string][] = [['a', 'b'], ['b', 'c'], ['a', 'd']]

describe('MacroWorkflow — cột DAG và dây', () => {
  beforeEach(() => {
    vi.spyOn(workflowService, 'getMacroPhases').mockResolvedValue(PHASES)
    vi.spyOn(workflowService, 'getPhaseEdges').mockResolvedValue(EDGES)
    vi.spyOn(workflowService, 'getPhaseGraph').mockResolvedValue({})
    vi.spyOn(workflowService, 'getProjectArtifacts').mockResolvedValue([])
    useWorkflowStore.setState((s) => ({ selectedPhaseId: null, settings: { ...s.settings, settings: null } }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('x của thẻ theo cột DAG, bỏ qua x đã lưu sai cột', async () => {
    const { container } = render(<MacroWorkflow projectId="7" />)

    await waitFor(() => expect(container.querySelector('[data-phase-id="c"][role="button"]')).not.toBeNull())
    const left = (id: string) => (container.querySelector(`[data-phase-id="${id}"][role="button"]`) as HTMLElement).style.left
    expect(left('a')).toBe(`${columnX(0)}px`)
    expect(left('b')).toBe(`${columnX(1)}px`)
    expect(left('c')).toBe(`${columnX(2)}px`)
  })

  it('mọi dây có mũi tên; rê chuột vào B thì dây a→b, b→c nổi, a→d mờ', async () => {
    const { container } = render(<MacroWorkflow projectId="7" />)
    await waitFor(() => expect(container.querySelectorAll('[data-edge]')).toHaveLength(3))

    expect(container.querySelector('marker#phase-edge-arrow')).not.toBeNull()
    container.querySelectorAll('[data-edge] path:first-child').forEach((path) => {
      expect(path.getAttribute('marker-end')).toMatch(/^url\(#phase-edge-arrow/)
    })

    fireEvent.mouseEnter(container.querySelector('[data-phase-id="b"][role="button"]') as HTMLElement)

    const highlight = (edge: string) => container.querySelector(`[data-edge="${edge}"]`)?.getAttribute('data-highlight')
    expect(highlight('a->b')).toBe('on')
    expect(highlight('b->c')).toBe('on')
    expect(highlight('a->d')).toBe('dim')

    fireEvent.mouseLeave(container.querySelector('[data-phase-id="b"][role="button"]') as HTMLElement)
    expect(highlight('a->d')).toBe('normal')
  })
})
