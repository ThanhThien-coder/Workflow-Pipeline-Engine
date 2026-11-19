// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { BranchGraphNode, GhostGraphNode, GraphNodeMap, MacroPhase } from '../../../types/workflow.types'

// Hook Kanban gọi API thật: thay bằng giá trị rỗng, bài test này chỉ xem màn chi tiết phase
vi.mock('../../../hooks/usePhaseKanban', () => ({
  usePhaseKanban: () => ({
    phaseTasks: [], members: [], actor: null, loading: false, pendingTaskIds: [], submittingTask: null,
    isSubmitModalOpen: false, toastMessage: null, moveTask: vi.fn(), submitArtifact: vi.fn(),
    openSubmitModal: vi.fn(), closeSubmitModal: vi.fn(), refreshTasks: vi.fn(), updateAssignment: vi.fn(),
  }),
}))
vi.mock('../MacroWorkflow', () => ({ MacroWorkflow: () => <div data-testid="macro" /> }))

import { PhaseDetailView } from '../PhaseDetailView'
import { WorkflowView } from '../WorkflowView'

const PHASE: MacroPhase = {
  id: '12', name: 'PHASE 3', sub: 'Thiết kế hệ thống', accent: 'slate', status: 'IN_PROGRESS', pct: 40,
  x: 0, y: 0, w: 260, h: 128, parentPhaseIds: [], locked: false,
}
const TASK: BranchGraphNode = {
  kind: 'branch', id: '2', code: 'WPE-002', title: 'Thiết kế API', description: '', isTrack: false,
  status: 'TODO', assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root_12'],
}
const GHOST: GhostGraphNode = {
  id: 'ghost_9_to_2', kind: 'ghost', refPhase: '5', refId: '9', dir: 'up', targetTaskId: '2', title: 'Upstream', parentIds: [],
}
const TREE: GraphNodeMap = {
  root_12: { id: 'root_12', kind: 'root', title: 'PHASE 3', parentIds: [] },
  '2': TASK,
  ghost_9_to_2: GHOST,
}

function seedStore(over: Record<string, unknown> = {}) {
  useWorkflowStore.setState({
    currentProjectId: '7',
    graphStatus: 'ready',
    graphError: null,
    macroPhases: [PHASE],
    trees: { '12': TREE },
    selectedPhaseId: null,
    graphWritesUseApi: true,
    loadPhases: vi.fn(async () => {}),
    removeDependency: vi.fn(async () => {}),
    ...over,
  } as never)
}

describe('PhaseDetailView', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/project/7/workflow/phase/12')
  })
  afterEach(() => {
    cleanup()
  })

  it('hiện tên phase từ đường dẫn, nút Back về /project/7/workflow', () => {
    seedStore()
    render(<PhaseDetailView projectId="7" phaseId="12" />)

    expect(screen.getByRole('heading', { name: 'Thiết kế hệ thống' })).toBeDefined()
    expect(screen.getByText('40%')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back to workflow' }))
    expect(window.location.pathname).toBe('/project/7/workflow')
  })

  it('xóa ghost gọi removeDependency(phaseId, refId, targetTaskId), không gọi xóa node', () => {
    const removeDependency = vi.fn(async () => {})
    const removeNode = vi.fn(async () => {})
    seedStore({ removeDependency, removeNode })
    render(<PhaseDetailView projectId="7" phaseId="12" />)

    fireEvent.click(screen.getByTitle('Remove ghost prerequisite'))

    expect(removeDependency).toHaveBeenCalledTimes(1)
    expect(removeDependency).toHaveBeenCalledWith('12', '9', '2')
    expect(removeNode).not.toHaveBeenCalled()
  })

  it('✕ trên dây ghost gọi removeDependency với task nguồn ở phase khác', () => {
    const removeDependency = vi.fn(async () => {})
    seedStore({ removeDependency })
    const { container } = render(<PhaseDetailView projectId="7" phaseId="12" />)

    fireEvent.mouseEnter(container.querySelector('[data-edge-hit="ghost-edge-ghost_9_to_2-2"]') as Element)
    fireEvent.click(screen.getByRole('button', { name: 'Remove dependency' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(removeDependency).toHaveBeenCalledWith('12', '9', '2')
  })

  it('mở thẳng đường dẫn khi chưa tải đồ thị: gọi loadPhases(projectId) và hiện "Loading phase…"', () => {
    const loadPhases = vi.fn(async () => {})
    seedStore({ currentProjectId: null, graphStatus: 'idle', macroPhases: [], trees: {}, loadPhases })
    render(<PhaseDetailView projectId="7" phaseId="12" />)

    expect(loadPhases).toHaveBeenCalledWith('7')
    expect(screen.getByText('Loading phase…')).toBeDefined()
  })

  it('đồ thị của dự án khác thì không dùng, tải lại cho dự án này', () => {
    const loadPhases = vi.fn(async () => {})
    seedStore({ currentProjectId: '99', loadPhases })
    render(<PhaseDetailView projectId="7" phaseId="12" />)

    expect(loadPhases).toHaveBeenCalledWith('7')
    expect(screen.getByText('Loading phase…')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Thiết kế hệ thống' })).toBeNull()
  })

  it('tải xong mà không có phase: "Phase not found" và nút Back', () => {
    seedStore({ macroPhases: [], trees: {} })
    render(<PhaseDetailView projectId="7" phaseId="12" />)

    expect(screen.getByText('Phase not found')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back to workflow' }))
    expect(window.location.pathname).toBe('/project/7/workflow')
  })

  it('store xóa selectedPhaseId (loadPhases đổi dự án) vẫn không làm màn chi tiết mất phase', () => {
    seedStore({ selectedPhaseId: null })
    render(<PhaseDetailView projectId="7" phaseId="12" />)
    expect(screen.getByRole('heading', { name: 'Thiết kế hệ thống' })).toBeDefined()
  })
})

describe('WorkflowView — đồng bộ đường dẫn và selectedPhaseId', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/project/7/workflow')
  })
  afterEach(() => cleanup())

  it('có phaseId thì hiện màn chi tiết (không có Macro) và đặt selectedPhaseId theo đường dẫn', () => {
    window.history.replaceState({}, '', '/project/7/workflow/phase/12')
    seedStore()
    render(<WorkflowView projectId="7" phaseId="12" />)

    expect(screen.queryByTestId('macro')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Thiết kế hệ thống' })).toBeDefined()
    expect(useWorkflowStore.getState().selectedPhaseId).toBe('12')
  })

  it('store bị xóa selectedPhaseId khi tải lại thì đặt lại, không nhảy về Macro', async () => {
    window.history.replaceState({}, '', '/project/7/workflow/phase/12')
    seedStore({ selectedPhaseId: '12' })
    render(<WorkflowView projectId="7" phaseId="12" />)

    act(() => {
      useWorkflowStore.setState({ selectedPhaseId: null, graphStatus: 'loading' })
    })
    await waitFor(() => expect(useWorkflowStore.getState().selectedPhaseId).toBe('12'))
    expect(window.location.pathname).toBe('/project/7/workflow/phase/12')
  })

  it('không có phaseId thì hiện Macro; chọn phase trong store thì chuyển tới đường dẫn phase', async () => {
    seedStore()
    render(<WorkflowView projectId="7" phaseId={null} />)
    expect(screen.getByTestId('macro')).toBeDefined()

    act(() => {
      useWorkflowStore.getState().selectPhase('12')
    })
    await waitFor(() => expect(window.location.pathname).toBe('/project/7/workflow/phase/12'))
  })

  it('đường dẫn đổi về Macro (nút Back) thì selectedPhaseId về null, không bật lại phase cũ', async () => {
    window.history.replaceState({}, '', '/project/7/workflow/phase/12')
    seedStore()
    const { rerender } = render(<WorkflowView projectId="7" phaseId="12" />)
    expect(useWorkflowStore.getState().selectedPhaseId).toBe('12')

    window.history.replaceState({}, '', '/project/7/workflow')
    rerender(<WorkflowView projectId="7" phaseId={null} />)

    await waitFor(() => expect(useWorkflowStore.getState().selectedPhaseId).toBeNull())
    expect(window.location.pathname).toBe('/project/7/workflow')
  })
})
