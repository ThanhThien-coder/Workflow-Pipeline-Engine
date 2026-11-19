// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WorkflowServiceProvider } from '../../../services/workflow/WorkflowContext'
import { AddGhostModal } from '../AddGhostModal'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { BranchGraphNode, MacroPhase } from '../../../types/workflow.types'

const phase = (id: string, name: string): MacroPhase => ({
  id, name, sub: '', status: 'TODO', pct: 0, accent: 'blue', w: 200, h: 100, parentPhaseIds: [],
})
const task = (id: string, code: string, title: string): BranchGraphNode => ({
  kind: 'branch', id, code, title, isTrack: false, status: 'TODO', parentIds: [], description: '',
  assignee: null, due: null, blocker: null, joinPolicy: null,
})

describe('AddGhostModal: ô tìm task nguồn', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      macroPhases: [phase('cur', 'Current'), phase('src', 'Source')],
      trees: {
        cur: { x: task('x', 'CUR-1', 'Target') },
        src: {
          a: task('a', 'SRC-1', 'Thiết kế schema'),
          b: task('b', 'SRC-2', 'Viết migration'),
        },
      },
    })
  })
  afterEach(() => cleanup())

  it('gõ vào ô tìm thì danh sách task nguồn chỉ còn mục khớp (không phân biệt dấu)', () => {
    render(
      <WorkflowServiceProvider>
        <AddGhostModal isOpen onClose={vi.fn()} currentPhaseId="cur" />
      </WorkflowServiceProvider>,
    )
    const select = screen.getByLabelText('Source Milestone / Task') as HTMLSelectElement
    expect(select.options).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Search source tasks'), { target: { value: 'thiet ke' } })
    expect(select.options).toHaveLength(1)
    expect(select.options[0].textContent).toContain('Thiết kế schema')
    expect(select.value).toBe('a')

    fireEvent.change(screen.getByLabelText('Search source tasks'), { target: { value: 'zzz' } })
    expect(select.options[0].textContent).toBe('No tasks match your search')
  })
})
