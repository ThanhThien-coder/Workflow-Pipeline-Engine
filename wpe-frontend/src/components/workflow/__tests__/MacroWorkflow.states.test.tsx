// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { workflowService } from '../../../services/container'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { MacroPhase } from '../../../types/workflow.types'

const { fitSpy } = vi.hoisted(() => ({ fitSpy: vi.fn().mockReturnValue(true) }))

vi.mock('../../../hooks/usePanZoom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/usePanZoom')>()
  return {
    ...actual,
    usePanZoom: () => ({ ...actual.usePanZoom(), fitToBounds: fitSpy }),
  }
})

import { MacroWorkflow } from '../MacroWorkflow'

function phase(id: string, parentPhaseIds: string[] = [], pos?: { x: number; y: number }): MacroPhase {
  return { id, name: id.toUpperCase(), sub: '', status: 'TODO', pct: 0, accent: 'slate', w: 380, h: 180, parentPhaseIds, ...pos }
}

describe('MacroWorkflow — trạng thái tải, Fit, nút Artifacts (TASK_72)', () => {
  const originalLoad = useWorkflowStore.getState().loadPhases
  let load: Mock<(projectId?: string) => Promise<void>>

  beforeEach(() => {
    fitSpy.mockClear()
    vi.spyOn(workflowService, 'getProjectArtifacts').mockResolvedValue([])
    // loadPhases giả: không đổi trạng thái, để test tự đặt graphStatus
    load = vi.fn<(projectId?: string) => Promise<void>>().mockResolvedValue(undefined)
    useWorkflowStore.setState({ loadPhases: load, selectedPhaseId: null, macroPhases: [], workflowEdges: [], graphStatus: 'idle', graphError: null })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useWorkflowStore.setState({ loadPhases: originalLoad, macroPhases: [], workflowEdges: [], graphStatus: 'idle', graphError: null })
  })

  it('đang tải và chưa có phase thì hiện khung chờ', () => {
    useWorkflowStore.setState({ graphStatus: 'loading' })
    const { container } = render(<MacroWorkflow projectId="7" />)
    expect(screen.getByRole('status', { name: 'Loading phases' })).toBeDefined()
    expect(container.querySelectorAll('[data-skeleton-card]').length).toBeGreaterThan(0)
  })

  it('lỗi tải hiện thông báo + Retry, bấm Retry gọi lại loadPhases', () => {
    useWorkflowStore.setState({ graphStatus: 'error', graphError: 'Boom' })
    render(<MacroWorkflow projectId="7" />)
    expect(screen.getByText('Boom')).toBeDefined()

    load.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(load).toHaveBeenCalledWith('7')
  })

  it('sẵn sàng nhưng 0 phase thì hiện câu hướng dẫn', () => {
    useWorkflowStore.setState({ graphStatus: 'ready' })
    render(<MacroWorkflow projectId="7" />)
    expect(screen.getByText(/No phases yet/)).toBeDefined()
  })

  it('nút Fit (bàn tay) gọi fitToBounds với khung bao mọi thẻ và contentOffset 20', () => {
    useWorkflowStore.setState({
      graphStatus: 'ready',
      macroPhases: [phase('a', [], { x: 40, y: 60 }), phase('b', ['a'], { x: 510, y: 60 })],
      workflowEdges: [['a', 'b']],
    })
    render(<MacroWorkflow projectId="7" />)
    fitSpy.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Fit graph to view' }))
    expect(fitSpy).toHaveBeenCalledTimes(1)
    const [bounds, options] = fitSpy.mock.calls[0]
    expect(bounds).toEqual({ minX: 40, minY: 60, maxX: 510 + 380, maxY: 60 + 180 })
    expect(options).toMatchObject({ contentOffset: { x: 20, y: 20 } })
  })

  it('tự fit đúng MỘT lần sau khi tải xong có phase, không fit lại khi dữ liệu đổi', async () => {
    const phasesA = [phase('a', [], { x: 40, y: 60 })]
    useWorkflowStore.setState({
      loadPhases: vi.fn(async () => {
        useWorkflowStore.setState({ graphStatus: 'loading' })
        await Promise.resolve()
        useWorkflowStore.setState({ graphStatus: 'ready', macroPhases: phasesA })
      }),
    })
    render(<MacroWorkflow projectId="7" />)
    await waitFor(() => expect(fitSpy).toHaveBeenCalledTimes(1))

    act(() => {
      useWorkflowStore.setState({ macroPhases: [...phasesA, phase('b', ['a'], { x: 510, y: 60 })] })
    })
    expect(fitSpy).toHaveBeenCalledTimes(1)
  })
  it('nút Artifacts nằm trong header cạnh Add Phase; popover mở ngay dưới nút', () => {
    render(<MacroWorkflow projectId="7" />)
    const button = screen.getByRole('button', { name: /Open deliverables artifacts/i })
    const header = button.closest('div.border-b') as HTMLElement
    expect(header).not.toBeNull()
    expect(header.textContent).toContain('Add Phase')

    fireEvent.click(button)
    const panel = document.querySelector('aside') as HTMLElement
    expect(panel).not.toBeNull()
    expect(header.contains(panel)).toBe(true)
    expect(panel.parentElement).toBe(button.parentElement)
    expect(panel.className).toContain('top-full')
    expect(panel.className).toContain('right-0')
    useWorkflowStore.getState().artifacts.closeDrawer()
  })
})
