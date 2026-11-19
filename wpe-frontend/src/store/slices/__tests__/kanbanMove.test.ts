// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWorkflowStore } from '../../useWorkflowStore'
import { workflowService } from '../../../services/container'
import { ApiError } from '../../../services/http/ApiError'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

/** TASK_70 — My Tasks: kéo thả theo luật backend, lý do khi trả task, lỗi 409. */

function task(id: string, status: KanbanTask['status'], assignedUserId = '9'): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId, phaseId: '56', phaseLabel: 'Build',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}
const OWNER: UserSummary = { id: '9', name: 'o', roleTitle: '', initials: 'O', avatarClass: 'bg-slate-300', projectRole: 'OWNER', assignedTaskCount: 0 }

describe('kanban.moveTask (My Tasks)', () => {
  beforeEach(() => {
    useWorkflowStore.setState((state) => ({
      currentProjectId: '19',
      kanban: { ...state.kanban, currentUserId: '9', members: [OWNER], tasks: [task('1', 'REVIEW', '5'), task('2', 'TODO')], pendingTaskIds: [] },
    }))
  })
  afterEach(() => vi.restoreAllMocks())

  it('REVIEW -> IN_PROGRESS chưa có lý do: không gọi API, thẻ giữ chỗ cũ', async () => {
    const update = vi.spyOn(workflowService, 'updateTaskStatus')
    await useWorkflowStore.getState().kanban.moveTask('1', 'IN_PROGRESS')
    expect(update).not.toHaveBeenCalled()
    expect(useWorkflowStore.getState().kanban.tasks.find((t) => t.id === '1')?.status).toBe('REVIEW')
  })

  it('REVIEW -> IN_PROGRESS có lý do: updateTaskStatus(id, IN_PROGRESS, lý do)', async () => {
    const update = vi.spyOn(workflowService, 'updateTaskStatus').mockResolvedValue(task('1', 'IN_PROGRESS', '5'))
    await useWorkflowStore.getState().kanban.moveTask('1', 'IN_PROGRESS', 'Thiếu test')
    expect(update).toHaveBeenCalledWith('1', 'IN_PROGRESS', 'Thiếu test')
  })

  it('người đăng nhập không phải Owner/Manager không mượn quyền Owner để trả task', async () => {
    const collab: UserSummary = { ...OWNER, id: '5', projectRole: 'COLLABORATOR' }
    useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, currentUserId: '5', members: [OWNER, collab] } }))
    const update = vi.spyOn(workflowService, 'updateTaskStatus')
    await useWorkflowStore.getState().kanban.moveTask('1', 'IN_PROGRESS', 'lý do')
    expect(update).not.toHaveBeenCalled()
  })

  it('409: tải lại My Tasks, hoàn lại thẻ và báo bản cũ', async () => {
    vi.spyOn(workflowService, 'updateTaskStatus').mockRejectedValue(new ApiError({ status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT', message: 'x' }))
    const getMyTasks = vi.spyOn(workflowService, 'getMyTasks').mockResolvedValue([task('2', 'TODO')])
    vi.spyOn(workflowService, 'getMacroPhases').mockResolvedValue([])

    await useWorkflowStore.getState().kanban.moveTask('2', 'IN_PROGRESS')

    expect(getMyTasks).toHaveBeenCalledWith('19', '9')
    expect(useWorkflowStore.getState().kanban.toast).toBe('This task was changed by someone else. The board has been refreshed, please try again.')
    expect(useWorkflowStore.getState().kanban.tasks.find((t) => t.id === '2')?.status).toBe('TODO')
  })

  it('409 khác lệch version (dự án đã lưu trữ): không tải lại, giữ câu báo của backend', async () => {
    vi.spyOn(workflowService, 'updateTaskStatus').mockRejectedValue(
      new ApiError({ status: 409, code: 'PROJECT_ARCHIVED', message: 'This project is archived.' })
    )
    const getMyTasks = vi.spyOn(workflowService, 'getMyTasks')

    await useWorkflowStore.getState().kanban.moveTask('2', 'IN_PROGRESS')

    expect(getMyTasks).not.toHaveBeenCalled()
    expect(useWorkflowStore.getState().kanban.toast).toBe('This project is archived.')
  })
})
