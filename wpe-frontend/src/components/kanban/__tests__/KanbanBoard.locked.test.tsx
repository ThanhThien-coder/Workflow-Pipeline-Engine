// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KanbanBoard } from '../KanbanBoard'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

/** G15 — My Tasks có cột "Đang khóa" cho task của mình đang chờ task trước; không thả task vào cột này. */

function task(id: string, status: KanbanTask['status']): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId: '9', phaseId: '56', phaseLabel: '',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

const ACTOR: UserSummary = { id: '9', name: 'a', roleTitle: 'OWNER', initials: 'A', avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0 }

describe('KanbanBoard (My Tasks) — cột Đang khóa', () => {
  afterEach(() => cleanup())

  it('có 5 cột, task LOCKED nằm ở cột "Đang khóa" kèm nhãn chờ task trước', () => {
    render(<KanbanBoard tasks={[task('1', 'LOCKED'), task('2', 'TODO')]} actor={ACTOR} pendingIds={[]} onMove={() => {}} filtering={false} onOpenDetails={() => {}} />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Locked', 'To Do', 'In Progress', 'In Review', 'Done'])
    const lockedColumn = screen.getByRole('heading', { name: 'Locked' }).closest('section') as HTMLElement
    expect(lockedColumn.textContent).toContain('WPE-1')
    expect(lockedColumn.textContent).toContain('Waiting on prerequisites')
  })

  it('thả task vào cột Đang khóa: không gọi onMove', () => {
    const onMove = vi.fn()
    render(<KanbanBoard tasks={[task('2', 'TODO')]} actor={ACTOR} pendingIds={[]} onMove={onMove} filtering={false} onOpenDetails={() => {}} />)

    const lockedColumn = screen.getByRole('heading', { name: 'Locked' }).closest('section') as HTMLElement
    fireEvent.drop(lockedColumn, { dataTransfer: { getData: () => '2' } })

    expect(onMove).not.toHaveBeenCalled()
  })
})
