// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NodePropertiesModal } from '../NodePropertiesModal'
import type { BranchGraphNode } from '../../../types/workflow.types'
import type { UserSummary } from '../../../types/kanban.types'
import type { Prerequisite } from '../../../utils/taskPrerequisites'

/** T6 — hộp Chi tiết task: khung điều kiện, nút hành động theo vai trò, mở khóa sớm có cảnh báo. */

function node(status: BranchGraphNode['status'], assignee: string | null = '9', extra: Partial<BranchGraphNode> = {}): BranchGraphNode {
  return {
    kind: 'branch', id: 'c', code: 'WPE-003', title: 'Deploy', description: '', isTrack: false, status,
    assignee, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['a', 'b'], ...extra,
  }
}

const MEMBERS: UserSummary[] = [
  { id: '9', name: 'a', roleTitle: 'OWNER', initials: 'A', avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0 },
  { id: '12', name: 'b', roleTitle: 'COLLABORATOR', initials: 'B', avatarClass: 'bg-indigo-500', projectRole: 'COLLABORATOR', assignedTaskCount: 0 },
]

const PREREQS: Prerequisite[] = [
  { id: 'a', code: 'WPE-001', title: 'Thiết kế API', done: true, external: false },
  { id: 'b', code: 'WPE-002', title: 'Code BE', done: false, external: false },
]

const noop = () => {}

describe('NodePropertiesModal — Chi tiết task (T6)', () => {
  afterEach(() => cleanup())

  it('khung điều kiện: "Chờ 1/2 task trước xong (cần tất cả)", ✔ / ○ đúng từng task', () => {
    render(<NodePropertiesModal node={node('LOCKED')} members={MEMBERS} prerequisites={PREREQS} onClose={noop} onDelete={noop} />)

    const box = screen.getByTestId('prerequisites')
    expect(box.textContent).toContain('Chờ 1/2 task trước xong (cần tất cả)')
    expect(box.textContent).toContain('WPE-001')
    expect(box.textContent).toContain('WPE-002')
  })

  it('chủ dự án + LOCKED: "Mở khóa sớm" hỏi xác nhận, liệt kê task chưa xong; Vẫn mở khóa thì gọi onForceUnlock', () => {
    const onForceUnlock = vi.fn()
    render(<NodePropertiesModal node={node('LOCKED')} members={MEMBERS} prerequisites={PREREQS} isOwner onForceUnlock={onForceUnlock} onClose={noop} onDelete={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /mở khóa sớm/i }))
    expect(onForceUnlock).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('WPE-002')
    expect(dialog.textContent).not.toContain('WPE-001')

    fireEvent.click(screen.getByRole('button', { name: /vẫn mở khóa/i }))
    expect(onForceUnlock).toHaveBeenCalledTimes(1)
  })

  it('task trước đều xong thì mở khóa sớm không cần hỏi lại', () => {
    const onForceUnlock = vi.fn()
    const allDone = PREREQS.map((p) => ({ ...p, done: true }))
    render(<NodePropertiesModal node={node('LOCKED')} prerequisites={allDone} isOwner onForceUnlock={onForceUnlock} onClose={noop} onDelete={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /mở khóa sớm/i }))
    expect(onForceUnlock).toHaveBeenCalledTimes(1)
  })

  it('không phải chủ dự án thì không thấy nút Mở khóa sớm', () => {
    render(<NodePropertiesModal node={node('LOCKED')} prerequisites={PREREQS} onForceUnlock={vi.fn()} onClose={noop} onDelete={noop} readOnly />)
    expect(screen.queryByRole('button', { name: /mở khóa sớm/i })).toBeNull()
  })

  it('người được giao: TODO thấy "Bắt đầu", IN_PROGRESS thấy "Nộp để duyệt"; người khác không thấy', () => {
    const onMoveStatus = vi.fn()
    const { rerender } = render(
      <NodePropertiesModal node={node('TODO')} members={MEMBERS} viewerId="9" onMoveStatus={onMoveStatus} onClose={noop} onDelete={noop} />
    )
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }))
    expect(onMoveStatus).toHaveBeenLastCalledWith('IN_PROGRESS', undefined)

    rerender(<NodePropertiesModal node={node('IN_PROGRESS')} members={MEMBERS} viewerId="9" onMoveStatus={onMoveStatus} onClose={noop} onDelete={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /nộp để duyệt/i }))
    expect(onMoveStatus).toHaveBeenLastCalledWith('REVIEW', undefined)

    rerender(<NodePropertiesModal node={node('TODO')} members={MEMBERS} viewerId="12" onMoveStatus={onMoveStatus} onClose={noop} onDelete={noop} readOnly />)
    expect(screen.queryByRole('button', { name: /bắt đầu/i })).toBeNull()
  })

  it('chủ dự án + REVIEW: Duyệt → DONE; Trả lại cần lý do → IN_PROGRESS kèm lý do', () => {
    const onMoveStatus = vi.fn()
    render(<NodePropertiesModal node={node('REVIEW')} members={MEMBERS} canReview onMoveStatus={onMoveStatus} onClose={noop} onDelete={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /^trả lại$/i }))
    const rejectButtons = screen.getAllByRole('button', { name: /trả lại/i })
    const confirmReject = rejectButtons[rejectButtons.length - 1] as HTMLButtonElement
    expect(confirmReject.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('Cần sửa gì…'), { target: { value: 'Thiếu test' } })
    fireEvent.click(confirmReject)
    expect(onMoveStatus).toHaveBeenLastCalledWith('IN_PROGRESS', 'Thiếu test')
  })

  it('task đã mở sớm có nhãn "Mở sớm"', () => {
    render(<NodePropertiesModal node={node('TODO', '9', { forceUnlocked: true })} onClose={noop} onDelete={noop} />)
    expect(screen.getByText('Mở sớm')).toBeTruthy()
  })
})
