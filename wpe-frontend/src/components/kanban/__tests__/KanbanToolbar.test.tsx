// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KanbanToolbar } from '../KanbanToolbar'
import type { KanbanTask } from '../../../types/kanban.types'

/**
 * G13: lựa chọn phase sinh từ phase thật có trong danh sách task (không viết cứng Phase 1/2A/2B/3).
 * G16: lọc bằng một ô chọn (không còn mỗi phase một nút làm tràn dòng).
 */

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

  it('một ô chọn: "Tất cả" + mỗi phase có task một mục (không trùng) kèm số task; không có nút phase', () => {
    render(<KanbanToolbar query="" phase="ALL" tasks={TASKS} onQuery={() => {}} onPhase={() => {}} />)

    const select = screen.getByRole('combobox', { name: 'Filter by phase' })
    const labels = Array.from(select.querySelectorAll('option')).map((option) => option.textContent)
    expect(labels).toEqual(['All phases (3)', 'PHASE 4 · Cụm công việc 4 (2)', 'PHASE 5 · Cụm công việc 5 (1)'])
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('chọn một phase thì báo đúng id phase thật', () => {
    const onPhase = vi.fn()
    render(<KanbanToolbar query="" phase="ALL" tasks={TASKS} onQuery={() => {}} onPhase={onPhase} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by phase' }), { target: { value: '57' } })

    expect(onPhase).toHaveBeenCalledWith('57')
  })

  it('nhiều phase vẫn chỉ một ô chọn', () => {
    const many = Array.from({ length: 12 }, (_, index) => task(String(index), String(100 + index), `PHASE ${index + 1} · Cụm ${index + 1}`))
    render(<KanbanToolbar query="" phase="ALL" tasks={many} onQuery={() => {}} onPhase={() => {}} />)

    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.getAllByRole('option')).toHaveLength(13)
  })
})
