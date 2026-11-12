// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TaskDetailModal } from '../TaskDetailModal'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

describe('TaskDetailModal Component', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const mockMembers: UserSummary[] = [
    {
      id: '1',
      name: 'Alex Kim',
      roleTitle: 'Project Lead',
      initials: 'AK',
      avatarClass: 'bg-emerald-500',
      projectRole: 'OWNER',
      assignedTaskCount: 3,
    },
    {
      id: '2',
      name: 'Sarah Chen',
      roleTitle: 'Frontend Dev',
      initials: 'SC',
      avatarClass: 'bg-indigo-500',
      projectRole: 'COLLABORATOR',
      assignedTaskCount: 2,
    },
    {
      id: '3',
      name: 'Marcus Liu',
      roleTitle: 'Engineering Manager',
      initials: 'ML',
      avatarClass: 'bg-rose-500',
      projectRole: 'MANAGER',
      assignedTaskCount: 1,
    },
  ]

  const mockTask: KanbanTask = {
    id: 't-101',
    code: 'WPE-101',
    title: 'Thiết kế hệ thống quyền',
    description: 'Chi tiết phân quyền',
    status: 'REVIEW',
    assignedUserId: '2',
    phaseId: 'P1',
    phaseLabel: 'Phase 1 · Foundation',
    dueDate: '2026-10-15T23:59:59+07:00',
    isOverdue: false,
    joinPolicySummary: 'AND-Join',
    artifacts: [],
    version: 1,
  }

  const managerActor: UserSummary = mockMembers[2] // projectRole: 'MANAGER'
  const ownerActor: UserSummary = mockMembers[0] // projectRole: 'OWNER'
  const collabActor: UserSummary = mockMembers[1] // projectRole: 'COLLABORATOR'

  it('actor MANAGER thấy nút duyệt (Approve) và trả lại (Request Changes) khi task ở REVIEW', () => {
    const handleMove = vi.fn()
    const handleClose = vi.fn()

    render(
      <TaskDetailModal
        task={mockTask}
        actor={managerActor}
        members={mockMembers}
        onClose={handleClose}
        onMove={handleMove}
      />
    )

    // Manager thấy nút Approve và Request Changes
    expect(screen.getByRole('button', { name: /Approve/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Request Changes/i })).toBeDefined()

    // Không thấy chữ chờ duyệt của owner/quản lý
    expect(screen.queryByText(/Pending Review/i)).toBeNull()
  })

  it('actor OWNER thấy nút duyệt khi task ở REVIEW', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        actor={ownerActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Approve/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Request Changes/i })).toBeDefined()
  })

  it('actor COLLABORATOR không thấy nút duyệt khi task ở REVIEW và thấy dòng chữ Awaiting Owner/Quản lý', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        actor={collabActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Approve/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Request Changes/i })).toBeNull()
    expect(screen.getByText(/Pending Review \(Awaiting Owner\/Quản lý\)/i)).toBeDefined()
  })

  it('actor MANAGER thấy khối "Phân công" khi có onUpdateAssignment và task chưa DONE', async () => {
    const handleUpdateAssignment = vi.fn().mockResolvedValue(true)
    const inProgressTask: KanbanTask = { ...mockTask, status: 'IN_PROGRESS' }

    render(
      <TaskDetailModal
        task={inProgressTask}
        actor={managerActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onUpdateAssignment={handleUpdateAssignment}
      />
    )

    // Thấy khối Phân công
    expect(screen.getByText('Phân công')).toBeDefined()
    const assigneeSelect = screen.getByLabelText('Người làm')
    const dueDateInput = screen.getByLabelText('Hạn chót')
    const saveButton = screen.getByRole('button', { name: /Lưu phân công/i })

    expect(assigneeSelect).toBeDefined()
    expect(dueDateInput).toBeDefined()
    // Chưa đổi gì nên nút bị tắt
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)

    // Đổi người làm sang Marcus Liu (id: '3')
    fireEvent.change(assigneeSelect, { target: { value: '3' } })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)

    // Bấm Lưu phân công -> chỉ gửi assignedUserId đã đổi
    fireEvent.click(saveButton)
    expect(handleUpdateAssignment).toHaveBeenCalledTimes(1)
    expect(handleUpdateAssignment).toHaveBeenCalledWith({
      assignedUserId: '3',
    })
  })

  it('chỉ gửi dueDate khi chỉ đổi hạn chót (chuyển sang ISO cuối ngày)', async () => {
    const handleUpdateAssignment = vi.fn().mockResolvedValue(true)

    render(
      <TaskDetailModal
        task={{ ...mockTask, status: 'TODO' }}
        actor={ownerActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onUpdateAssignment={handleUpdateAssignment}
      />
    )

    const dueDateInput = screen.getByLabelText('Hạn chót')
    const saveButton = screen.getByRole('button', { name: /Lưu phân công/i })

    // Đổi ngày hạn chót
    fireEvent.change(dueDateInput, { target: { value: '2026-11-20' } })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(saveButton)
    expect(handleUpdateAssignment).toHaveBeenCalledTimes(1)
    // Hạn chót là 23:59:59 theo giờ máy người dùng, gửi lên dạng ISO (UTC)
    expect(handleUpdateAssignment).toHaveBeenCalledWith({
      dueDate: new Date(2026, 10, 20, 23, 59, 59).toISOString(),
    })
  })

  it('actor COLLABORATOR không thấy khối "Phân công" kể cả khi có onUpdateAssignment', () => {
    const handleUpdateAssignment = vi.fn()

    render(
      <TaskDetailModal
        task={{ ...mockTask, status: 'TODO' }}
        actor={collabActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onUpdateAssignment={handleUpdateAssignment}
      />
    )

    expect(screen.queryByText('Phân công')).toBeNull()
    expect(screen.queryByRole('button', { name: /Lưu phân công/i })).toBeNull()
  })

  it('không thấy khối "Phân công" khi task ở trạng thái DONE', () => {
    const handleUpdateAssignment = vi.fn()

    render(
      <TaskDetailModal
        task={{ ...mockTask, status: 'DONE' }}
        actor={managerActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onUpdateAssignment={handleUpdateAssignment}
      />
    )

    expect(screen.queryByText('Phân công')).toBeNull()
    expect(screen.queryByRole('button', { name: /Lưu phân công/i })).toBeNull()
  })

  it('không thấy khối "Phân công" khi không truyền prop onUpdateAssignment', () => {
    render(
      <TaskDetailModal
        task={{ ...mockTask, status: 'TODO' }}
        actor={managerActor}
        members={mockMembers}
        onClose={vi.fn()}
        onMove={vi.fn()}
      />
    )

    expect(screen.queryByText('Phân công')).toBeNull()
    expect(screen.queryByRole('button', { name: /Lưu phân công/i })).toBeNull()
  })
})
