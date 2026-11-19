// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { MacroPhase } from '../../types/workflow.types'

/** TASK_73 (#15) — đường dẫn /project/:id/workflow/phase/:phaseId hiện màn chi tiết phase, sidebar dự án vẫn còn. */

vi.mock('../../services/env', () => ({ isMockMode: false }))
vi.mock('../../components/views/OverviewView', () => ({ OverviewView: () => null }))
vi.mock('../MyTasksView', () => ({ MyTasksView: () => null }))
vi.mock('../SettingsView', () => ({ default: () => null }))
vi.mock('../../components/common/NotificationBell', () => ({ default: () => null }))
vi.mock('../../components/common/GlobalProfileMenu', () => ({ GlobalProfileMenu: () => null }))
vi.mock('../../components/workflow/MacroWorkflow', () => ({ MacroWorkflow: () => <div data-testid="macro" /> }))
vi.mock('../../hooks/usePhaseKanban', () => ({
  usePhaseKanban: () => ({
    phaseTasks: [], members: [], actor: null, loading: false, pendingTaskIds: [], submittingTask: null,
    isSubmitModalOpen: false, toastMessage: null, moveTask: vi.fn(), submitArtifact: vi.fn(),
    openSubmitModal: vi.fn(), closeSubmitModal: vi.fn(), refreshTasks: vi.fn(), updateAssignment: vi.fn(),
  }),
}))
vi.mock('../../components/layout/CurvedCobaltSidebar', () => ({
  CurvedCobaltSidebar: () => <nav data-testid="sidebar">project sidebar</nav>,
}))

import { ProjectWorkspaceView } from '../ProjectWorkspaceView'

const PHASE: MacroPhase = {
  id: '12', name: 'PHASE 3', sub: 'Thiết kế hệ thống', accent: 'slate', status: 'IN_PROGRESS', pct: 40,
  x: 0, y: 0, w: 260, h: 128, parentPhaseIds: [], locked: false,
}

describe('ProjectWorkspaceView — màn chi tiết phase', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/project/7/workflow/phase/12')
    useWorkflowStore.setState((state) => ({
      currentProjectId: '7',
      graphStatus: 'ready',
      macroPhases: [PHASE],
      trees: { '12': { root_12: { id: 'root_12', kind: 'root', title: 'PHASE 3', parentIds: [] } } },
      selectedPhaseId: null,
      loadPhases: vi.fn(async () => {}),
      project: { ...state.project, loadProject: vi.fn(async () => {}) },
    }) as never)
  })
  afterEach(() => cleanup())

  it('/project/7/workflow/phase/12 hiện PhaseDetailView của phase 12, giữ sidebar, không có Macro', () => {
    render(<ProjectWorkspaceView projectId="7" subTab="workflow" phaseId="12" />)

    expect(screen.getByTestId('sidebar')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Thiết kế hệ thống' })).toBeDefined()
    expect(screen.queryByTestId('macro')).toBeNull()
  })

  it('nút Back về /project/7/workflow', () => {
    render(<ProjectWorkspaceView projectId="7" subTab="workflow" phaseId="12" />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to workflow' }))
    expect(window.location.pathname).toBe('/project/7/workflow')
  })

  it('không có phaseId thì hiện Macro như cũ', () => {
    window.history.replaceState({}, '', '/project/7/workflow')
    render(<ProjectWorkspaceView projectId="7" subTab="workflow" />)

    expect(screen.getByTestId('macro')).toBeDefined()
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })
})
