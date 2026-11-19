// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TaskCard } from '../TaskCard'
import type { KanbanTask } from '../../../types/kanban.types'

function task(over: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: '7', code: 'WPE-7', title: 'Task bảy', description: '', status: 'TODO', assignedUserId: '9', phaseId: '1', phaseLabel: 'Build',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0, ...over,
  }
}

describe('TaskCard', () => {
  afterEach(() => cleanup())

  it('dragstart đặt text/plain = id task và effectAllowed = move (Firefox)', () => {
    const onDragStart = vi.fn()
    render(<TaskCard task={task()} onOpenDetails={() => {}} onDragStart={onDragStart} />)
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    fireEvent.dragStart(screen.getByTestId('task-card-7'), { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '7')
    expect(dataTransfer.effectAllowed).toBe('move')
    expect(onDragStart).toHaveBeenCalledWith('7')
  })

  it('isOverdue hiện chip Overdue; DONE thì không', () => {
    const { rerender } = render(<TaskCard task={task({ isOverdue: true })} onOpenDetails={() => {}} />)
    expect(screen.getByText('Overdue')).toBeTruthy()
    rerender(<TaskCard task={task({ isOverdue: true, status: 'DONE' })} onOpenDetails={() => {}} />)
    expect(screen.queryByText('Overdue')).toBeNull()
    rerender(<TaskCard task={task({ isOverdue: false })} onOpenDetails={() => {}} />)
    expect(screen.queryByText('Overdue')).toBeNull()
  })

  it('nút chi tiết chỉ còn icon, tìm được theo tên truy cập, bấm mở chi tiết đúng 1 lần', () => {
    const onOpenDetails = vi.fn()
    render(<TaskCard task={task()} onOpenDetails={onOpenDetails} />)
    const button = screen.getByRole('button', { name: /open details/i })
    expect(button.getAttribute('title')).toBe('Details')
    expect(button.textContent).not.toMatch(/Details/)
    fireEvent.click(button)
    expect(onOpenDetails).toHaveBeenCalledTimes(1)
  })

  it('bấm cả thẻ vẫn mở chi tiết', () => {
    const onOpenDetails = vi.fn()
    render(<TaskCard task={task()} onOpenDetails={onOpenDetails} />)
    fireEvent.click(screen.getByTestId('task-card-7'))
    expect(onOpenDetails).toHaveBeenCalledTimes(1)
  })
})
