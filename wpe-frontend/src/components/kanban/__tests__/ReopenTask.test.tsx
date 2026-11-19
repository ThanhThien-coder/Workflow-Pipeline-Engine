// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TaskDetailModal } from '../TaskDetailModal'
import { evaluateTransition } from '../../../domain/taskTransitions'
import type { KanbanTask, ReopenImpact, UserSummary } from '../../../types/kanban.types'

/** S04: mở lại task đã Done (nút Reopen, hộp xác nhận, nhãn Before reopen, băng Reopened). */
describe('Reopen task (S04)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const owner: UserSummary = { id: '1', name: 'Alex Kim', roleTitle: 'Lead', initials: 'AK', avatarClass: 'bg-emerald-500', projectRole: 'OWNER', assignedTaskCount: 0 }
  const manager: UserSummary = { id: '3', name: 'Marcus Liu', roleTitle: 'EM', initials: 'ML', avatarClass: 'bg-rose-500', projectRole: 'MANAGER', assignedTaskCount: 0 }
  const worker: UserSummary = { id: '2', name: 'Sarah Chen', roleTitle: 'Dev', initials: 'SC', avatarClass: 'bg-indigo-500', projectRole: 'COLLABORATOR', assignedTaskCount: 0 }
  const members = [owner, worker, manager]

  const doneTask: KanbanTask = {
    id: '10', code: 'WPE-010', title: 'Build API', description: '', status: 'DONE', assignedUserId: '2', phaseId: 'P1', phaseLabel: 'P1',
    dueDate: '2026-10-15T23:59:59+07:00', isOverdue: false, joinPolicySummary: 'AND-Join', artifacts: [], version: 3,
  }

  const impact: ReopenImpact = {
    taskCode: 'WPE-010',
    children: [
      { id: '11', code: 'WPE-011', title: 'Todo child', status: 'TODO', willRelock: true },
      { id: '12', code: 'WPE-012', title: 'Started child', status: 'IN_PROGRESS', willRelock: false },
    ],
  }

  function renderModal(task: KanbanTask, actor: UserSummary, extra: { onReopen?: (r: string) => Promise<boolean>; withReopen?: boolean } = {}) {
    const onReopen = extra.onReopen ?? vi.fn(async () => true)
    const getReopenImpact = vi.fn(async () => impact)
    render(
      <TaskDetailModal
        task={task}
        actor={actor}
        members={members}
        onClose={() => {}}
        onMove={() => {}}
        {...(extra.withReopen === false ? {} : { onReopen, getReopenImpact })}
      />
    )
    return { onReopen, getReopenImpact }
  }

  it('Owner và Manager thấy nút Reopen task trên task Done', () => {
    renderModal(doneTask, owner)
    expect(screen.getByRole('button', { name: /Reopen task/i })).toBeTruthy()
    cleanup()
    renderModal(doneTask, manager)
    expect(screen.getByRole('button', { name: /Reopen task/i })).toBeTruthy()
  })

  it('Collaborator không thấy nút Reopen; task chưa Done cũng không', () => {
    renderModal(doneTask, worker)
    expect(screen.queryByRole('button', { name: /Reopen task/i })).toBeNull()
    cleanup()
    renderModal({ ...doneTask, status: 'IN_PROGRESS' }, owner)
    expect(screen.queryByRole('button', { name: /Reopen task/i })).toBeNull()
  })

  it('Không truyền onReopen thì không có nút Reopen', () => {
    renderModal(doneTask, owner, { withReopen: false })
    expect(screen.queryByRole('button', { name: /Reopen task/i })).toBeNull()
  })

  it('Hộp xác nhận liệt kê con bị khóa lại và con đã bắt đầu', async () => {
    renderModal(doneTask, owner)
    fireEvent.click(screen.getByRole('button', { name: /Reopen task/i }))
    expect(await screen.findByText(/Will be locked again/)).toBeTruthy()
    expect(screen.getAllByText(/Already started/).length).toBeGreaterThan(0)
    expect(screen.getByRole('alert').textContent).toContain('WPE-012')
  })

  it('Lý do bắt buộc: bỏ trống thì báo lỗi, không gọi onReopen', async () => {
    const { onReopen } = renderModal(doneTask, owner)
    fireEvent.click(screen.getByRole('button', { name: /Reopen task/i }))
    await screen.findByText(/Will be locked again/)
    fireEvent.click(screen.getByRole('button', { name: /^Reopen$/ }))
    expect(await screen.findByText(/Please enter a reason/)).toBeTruthy()
    expect(onReopen).not.toHaveBeenCalled()
  })

  it('Có lý do thì gọi onReopen với lý do đã cắt khoảng trắng', async () => {
    const { onReopen } = renderModal(doneTask, owner)
    fireEvent.click(screen.getByRole('button', { name: /Reopen task/i }))
    await screen.findByText(/Will be locked again/)
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: '  Wrong output  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^Reopen$/ }))
    await waitFor(() => expect(onReopen).toHaveBeenCalledWith('Wrong output'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Reopen task/i })).toBeNull())
  })

  it('Task IN_PROGRESS có reopenedAt hiện băng "Reopened:" kèm lý do', () => {
    renderModal({ ...doneTask, status: 'IN_PROGRESS', rejectReason: 'Wrong output', reopenedAt: '2026-11-19T10:00:00Z' }, owner)
    expect(screen.getByText('Reopened:')).toBeTruthy()
    expect(screen.getByText('Wrong output')).toBeTruthy()
    expect(screen.queryByText(/Changes Requested by Reviewer/)).toBeNull()
  })

  it('Task IN_PROGRESS không có reopenedAt vẫn hiện "Changes Requested"', () => {
    renderModal({ ...doneTask, status: 'IN_PROGRESS', rejectReason: 'Fix it' }, owner)
    expect(screen.getByText(/Changes Requested by Reviewer/)).toBeTruthy()
  })

  it('Artifact nộp trước reopenedAt có nhãn Before reopen, artifact sau thì không', () => {
    renderModal({
      ...doneTask, status: 'IN_PROGRESS', reopenedAt: '2026-11-19T10:00:00Z',
      artifacts: [
        { id: 'a1', type: 'PR', url: 'https://x.test/old', note: 'old', uploadedAt: '2026-11-18T10:00:00Z', label: 'Old PR' },
        { id: 'a2', type: 'PR', url: 'https://x.test/new', note: 'new', uploadedAt: '2026-11-19T12:00:00Z', label: 'New PR' },
      ],
    }, owner)
    expect(screen.getAllByText('Before reopen')).toHaveLength(1)
  })

  it('Kéo thẻ từ Done vẫn bị chặn, câu báo trỏ tới nút Reopen task', () => {
    const decision = evaluateTransition(doneTask, 'IN_PROGRESS', owner)
    expect(decision.kind).toBe('deny')
    expect(decision.kind === 'deny' && decision.message).toContain('Reopen task')
  })
})
