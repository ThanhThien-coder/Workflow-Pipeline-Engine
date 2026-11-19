// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProjectSearchBox } from '../ProjectSearchBox'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { BranchGraphNode, MacroPhase } from '../../../types/workflow.types'

const navigateMock = vi.fn()
vi.mock('../../../router/useRouter', () => ({
  useRouter: () => ({ navigate: navigateMock }),
}))

const phase = (id: string, name: string): MacroPhase => ({
  id, name, sub: '', status: 'TODO', pct: 0, accent: 'blue', w: 200, h: 100, parentPhaseIds: [],
})
const task = (id: string, code: string, title: string): BranchGraphNode => ({
  kind: 'branch', id, code, title, isTrack: false, status: 'TODO', parentIds: [], description: '',
  assignee: null, due: null, blocker: null, joinPolicy: null,
})

function seedStore(overrides: Record<string, unknown> = {}) {
  useWorkflowStore.setState({
    currentProjectId: '7',
    graphStatus: 'ready',
    macroPhases: [phase('12', 'Thiết kế'), phase('13', 'Build')],
    trees: {
      '12': { a: task('a', 'WPE-1', 'Vẽ wireframe') },
      '13': { b: task('b', 'WPE-2', 'Cài CI') },
    },
    ...overrides,
  })
  useWorkflowStore.getState().ui.setHighlightNodeId(null)
}

describe('ProjectSearchBox', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    seedStore()
  })
  afterEach(() => cleanup())

  it('gõ mã task thì hiện dropdown, Enter mở đúng phase và đặt highlightNodeId', () => {
    render(<ProjectSearchBox projectId="7" />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wpe-2' } })
    expect(screen.getByRole('listbox')).toBeDefined()
    expect(screen.getByText('Cài CI')).toBeDefined()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/project/7/workflow/phase/13')
    expect(useWorkflowStore.getState().ui.highlightNodeId).toBe('b')
  })

  it('chọn phase thì chỉ navigate, không làm nổi node; gõ không dấu vẫn ra "Thiết kế"', () => {
    render(<ProjectSearchBox projectId="7" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'thiet ke' } })
    fireEvent.mouseDown(screen.getByText('Thiết kế'))
    expect(navigateMock).toHaveBeenCalledWith('/project/7/workflow/phase/12')
    expect(useWorkflowStore.getState().ui.highlightNodeId).toBeNull()
  })

  it('phím mũi tên xuống chuyển mục đang chọn và Esc đóng danh sách', () => {
    render(<ProjectSearchBox projectId="7" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'wpe' } })
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('/project/7/workflow/phase/13')

    fireEvent.change(input, { target: { value: 'wpe' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('không có kết quả thì báo "No results"', () => {
    render(<ProjectSearchBox projectId="7" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } })
    expect(screen.getByText('No results')).toBeDefined()
  })

  it('đồ thị chưa tải cho dự án này thì gọi loadPhases(projectId) và hiện Loading…', () => {
    const loadPhases = vi.fn().mockResolvedValue(undefined)
    seedStore({ currentProjectId: '99', graphStatus: 'ready', loadPhases })
    render(<ProjectSearchBox projectId="7" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wpe' } })
    expect(loadPhases).toHaveBeenCalledWith('7')
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('Ctrl+K focus ô tìm, nhưng không cướp khi đang gõ ở ô khác', () => {
    render(
      <div>
        <ProjectSearchBox projectId="7" />
        <input data-testid="other" />
      </div>,
    )
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(document.activeElement).toBe(input)

    const other = screen.getByTestId('other')
    other.focus()
    fireEvent.keyDown(other, { key: 'k', ctrlKey: true })
    expect(document.activeElement).toBe(other)
  })
})
