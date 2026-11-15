// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReviewQueueButton, formatBadgeCount } from '../ReviewQueueButton'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

/** G18 — nút "Chờ duyệt": huy hiệu tối đa 9+, danh sách task chờ duyệt, bấm task thì mở chi tiết. */

function task(id: string, assignedUserId = '12'): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status: 'REVIEW', assignedUserId, phaseId: '56',
    phaseLabel: 'PHASE 2 · Cụm công việc 2', dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

const MEMBERS: UserSummary[] = [
  { id: '12', name: 'b', roleTitle: 'COLLABORATOR', initials: 'B', avatarClass: 'bg-indigo-500', projectRole: 'COLLABORATOR', assignedTaskCount: 0 },
]

describe('formatBadgeCount', () => {
  it('1–9 giữ nguyên, trên 9 thành "9+"', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(9)).toBe('9')
    expect(formatBadgeCount(10)).toBe('9+')
    expect(formatBadgeCount(42)).toBe('9+')
  })
})

describe('ReviewQueueButton', () => {
  afterEach(() => cleanup())

  it('không có task chờ duyệt thì không có huy hiệu', () => {
    render(<ReviewQueueButton tasks={[]} members={MEMBERS} onOpenTask={() => {}} />)
    expect(screen.queryByTestId('review-badge')).toBeNull()
  })

  it('12 task chờ duyệt: huy hiệu "9+"', () => {
    const many = Array.from({ length: 12 }, (_, index) => task(String(index)))
    render(<ReviewQueueButton tasks={many} members={MEMBERS} onOpenTask={() => {}} />)
    expect(screen.getByTestId('review-badge').textContent).toBe('9+')
  })

  it('bấm nút: tải lại + hiện danh sách (mã, tên, người nộp); bấm một task thì báo onOpenTask và đóng danh sách', () => {
    const onOpen = vi.fn()
    const onOpenTask = vi.fn()
    render(<ReviewQueueButton tasks={[task('3'), task('5', '')]} members={MEMBERS} onOpen={onOpen} onOpenTask={onOpenTask} />)

    fireEvent.click(screen.getByRole('button', { name: /chờ duyệt/i }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    const list = screen.getByRole('dialog', { name: 'Danh sách task chờ duyệt' })
    expect(list.textContent).toContain('WPE-3')
    expect(list.textContent).toContain('Người nộp: b')
    expect(list.textContent).toContain('Người nộp: Chưa giao')

    fireEvent.click(screen.getByRole('button', { name: /WPE-5/ }))
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: '5' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('danh sách rỗng thì báo "Không có task nào chờ duyệt"', () => {
    render(<ReviewQueueButton tasks={[]} members={MEMBERS} onOpenTask={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /chờ duyệt/i }))
    expect(screen.getByText('Không có task nào chờ duyệt.')).toBeTruthy()
  })
})
