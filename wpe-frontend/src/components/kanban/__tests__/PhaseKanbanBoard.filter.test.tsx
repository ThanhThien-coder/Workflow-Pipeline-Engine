// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PhaseKanbanBoard } from '../PhaseKanbanBoard'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

const member = (id: string, name: string): UserSummary => ({
  id, name, roleTitle: '', initials: name.slice(0, 2).toUpperCase(), avatarClass: 'bg-slate-500', projectRole: 'COLLABORATOR', assignedTaskCount: 0,
})
const members = [member('1', 'Alex Kim'), member('2', 'Sarah Chen')]

const task = (id: string, code: string, title: string, assignedUserId: string, status: KanbanTask['status'] = 'TODO'): KanbanTask => ({
  id, code, title, description: '', status, assignedUserId, phaseId: 'P', phaseLabel: 'P', dueDate: '2026-10-06T00:00:00Z',
  isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
})
const tasks = [
  task('a', 'WPE-001', 'Thiết kế form', '1'),
  task('b', 'WPE-002', 'Viết API', '2', 'IN_PROGRESS'),
  task('c', 'WPE-003', 'Task chưa giao', '', 'TODO'),
]

const renderBoard = () =>
  render(<PhaseKanbanBoard phaseId="P" tasks={tasks} members={members} actor={members[0]} onOpenTaskDetails={vi.fn()} />)

describe('PhaseKanbanBoard: thanh lọc', () => {
  afterEach(() => cleanup())

  it('lọc chữ không phân biệt dấu theo mã hoặc tên, số đếm cột theo kết quả lọc', () => {
    renderBoard()
    fireEvent.change(screen.getByLabelText('Filter tasks by code or title'), { target: { value: 'thiet ke' } })
    expect(screen.getByText('Thiết kế form')).toBeDefined()
    expect(screen.queryByText('Viết API')).toBeNull()
    expect(within(screen.getByTestId('kanban-column-TODO')).getByText('1')).toBeDefined()
    expect(within(screen.getByTestId('kanban-column-IN_PROGRESS')).getByText('No tasks yet')).toBeDefined()
    expect(screen.getByText('1 of 3 tasks')).toBeDefined()
  })

  it('lọc theo người làm và Unassigned', () => {
    renderBoard()
    const select = screen.getByLabelText('Filter tasks by assignee')
    fireEvent.change(select, { target: { value: '2' } })
    expect(screen.getByText('Viết API')).toBeDefined()
    expect(screen.queryByText('Thiết kế form')).toBeNull()
    fireEvent.change(select, { target: { value: 'UNASSIGNED' } })
    expect(screen.getByText('Task chưa giao')).toBeDefined()
    expect(screen.queryByText('Viết API')).toBeNull()
  })

  it('"Only mine" chỉ còn task của actor; "Clear filters" trả lại tất cả', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Only mine' }))
    expect(screen.getByText('Thiết kế form')).toBeDefined()
    expect(screen.queryByText('Viết API')).toBeNull()
    expect(screen.queryByText('Task chưa giao')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Viết API')).toBeDefined()
    expect(screen.getByText('Task chưa giao')).toBeDefined()
    expect(screen.getByText('3 total tasks')).toBeDefined()
  })
})
