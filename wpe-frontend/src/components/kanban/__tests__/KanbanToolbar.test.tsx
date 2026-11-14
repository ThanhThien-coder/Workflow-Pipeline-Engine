// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KanbanToolbar } from '../KanbanToolbar'
import type { KanbanTask } from '../../../types/kanban.types'

/** G13 — nút lọc phase sinh từ phase thật có trong danh sách task, không viết cứng Phase 1/2A/2B/3. */

function task(id: string, phaseId: string, phaseLabel: string): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status: 'TODO', assignedUserId: '9', phaseId, phaseLabel,
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

describe('KanbanToolbar — lọc theo phase thật', () => {
  afterEach(() => cleanup())

  const TASKS = [
    task('1', '56', 'PHASE 4 · Cụm công việc 4'),
    task('2', '57', 'PHASE 5 · Cụm công việc 5'),
    task('3', '56', 'PHASE 4 · Cụm công việc 4'),
  ]

  it('mỗi phase có task là một nút (không trùng), có nút All; không còn nút Phase 2A giả', () => {
    render(<KanbanToolbar query="" phase="ALL" tasks={TASKS} onQuery={() => {}} onPhase={() => {}} />)

    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'PHASE 4 · Cụm công việc 4' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'PHASE 5 · Cụm công việc 5' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Phase 2A' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('bấm một phase thì báo đúng id phase thật', () => {
    const onPhase = vi.fn()
    render(<KanbanToolbar query="" phase="ALL" tasks={TASKS} onQuery={() => {}} onPhase={onPhase} />)

    fireEvent.click(screen.getByRole('button', { name: 'PHASE 5 · Cụm công việc 5' }))

    expect(onPhase).toHaveBeenCalledWith('57')
  })
})
