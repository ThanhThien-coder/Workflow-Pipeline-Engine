// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KanbanBoard } from '../KanbanBoard'
import { PhaseKanbanBoard } from '../PhaseKanbanBoard'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

function task(id: string, status: KanbanTask['status'], assignedUserId = '2'): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId, phaseId: '56', phaseLabel: '',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}
const member = (id: string, projectRole: UserSummary['projectRole']): UserSummary => ({ id, name: `u${id}`, roleTitle: '', initials: 'U', avatarClass: 'bg-slate-300', projectRole, assignedTaskCount: 0 })
const OWNER = member('9', 'OWNER')
const COLLAB = member('2', 'COLLABORATOR')

function dropOn(target: HTMLElement, id: string) {
  fireEvent.drop(target, { dataTransfer: { getData: () => id } })
}

describe('Hộp lý do khi kéo Review -> In Progress', () => {
  afterEach(() => cleanup())

  describe('Phase Kanban', () => {
    const renderBoard = (onMoveTask = vi.fn(), actor: UserSummary | undefined = OWNER) => {
      render(<PhaseKanbanBoard phaseId="56" tasks={[task('1', 'REVIEW'), task('2', 'TODO')]} members={[OWNER, COLLAB]} actor={actor} onOpenTaskDetails={() => {}} onMoveTask={onMoveTask} />)
      return onMoveTask
    }

    it('thả REVIEW -> IN_PROGRESS mở hộp; chưa nhập thì nút gửi bị khóa và không gọi onMoveTask', () => {
      const onMoveTask = renderBoard()
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '1')
      expect(screen.getByRole('dialog')).toBeTruthy()
      const send = screen.getByRole('button', { name: 'Request changes' }) as HTMLButtonElement
      expect(send.disabled).toBe(true)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
      expect(send.disabled).toBe(true)
      expect(onMoveTask).not.toHaveBeenCalled()
    })

    it('nhập lý do rồi gửi: onMoveTask(id, IN_PROGRESS, lý do đã cắt khoảng trắng)', () => {
      const onMoveTask = renderBoard()
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '1')
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Thiếu test  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
      expect(onMoveTask).toHaveBeenCalledWith('1', 'IN_PROGRESS', 'Thiếu test')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('Cancel và Esc đóng hộp, không gọi API', () => {
      const onMoveTask = renderBoard()
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '1')
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '1')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onMoveTask).not.toHaveBeenCalled()
    })

    it('người không có quyền duyệt: không mở hộp, đi thẳng onMoveTask để hook báo từ chối', () => {
      const onMoveTask = renderBoard(vi.fn(), COLLAB)
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '1')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onMoveTask).toHaveBeenCalledWith('1', 'IN_PROGRESS')
    })

    it('thả bước khác (TODO -> IN_PROGRESS) không hỏi lý do', () => {
      const onMoveTask = renderBoard()
      dropOn(screen.getByTestId('kanban-column-IN_PROGRESS'), '2')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(onMoveTask).toHaveBeenCalledWith('2', 'IN_PROGRESS')
    })
  })

  describe('My Tasks', () => {
    it('thả REVIEW -> IN_PROGRESS mở hộp, gửi lý do qua onMove', () => {
      const onMove = vi.fn()
      render(<KanbanBoard tasks={[task('1', 'REVIEW', '9')]} actor={OWNER} pendingIds={[]} onMove={onMove} filtering={false} onOpenDetails={() => {}} />)
      const column = screen.getByRole('heading', { name: 'In Progress' }).closest('section') as HTMLElement
      dropOn(column, '1')
      expect(onMove).not.toHaveBeenCalled()
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sửa lại' } })
      fireEvent.click(screen.getByRole('button', { name: 'Request changes' }))
      expect(onMove).toHaveBeenCalledWith('1', 'IN_PROGRESS', 'Sửa lại')
    })
  })
})
