// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useWorkflowStore } from '../../useWorkflowStore'
import { workflowService } from '../../../services/container'
import type { KanbanTask } from '../../../types/kanban.types'

/** G18 — hàng chờ duyệt; G17 — nộp minh chứng xong tải lại kho Artifacts. */

function task(id: string, status: KanbanTask['status'] = 'REVIEW'): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId: '12', phaseId: '56', phaseLabel: '',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

describe('kanban — hàng chờ duyệt (G18)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loadReviewTasks: tải task REVIEW của dự án, gắn tên phase thật', async () => {
    vi.spyOn(workflowService, 'getReviewTasks').mockResolvedValue([task('3')])
    vi.spyOn(workflowService, 'getMacroPhases').mockResolvedValue([
      { id: '56', name: 'PHASE 2', sub: 'Cụm công việc 2', status: 'TODO', pct: 0, accent: 'slate', w: 380, h: 180, parentPhaseIds: [] },
    ])

    await useWorkflowStore.getState().kanban.loadReviewTasks('26')

    const { reviewTasks, reviewStatus } = useWorkflowStore.getState().kanban
    expect(reviewStatus).toBe('ready')
    expect(reviewTasks.map((t) => [t.id, t.phaseLabel])).toEqual([['3', 'Cụm công việc 2']])
  })

  it('reviewTask DONE: gọi API, task rời hàng chờ duyệt', async () => {
    useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, reviewTasks: [task('3'), task('4')], pendingTaskIds: [] } }))
    const update = vi.spyOn(workflowService, 'updateTaskStatus').mockResolvedValue(task('3', 'DONE'))

    await useWorkflowStore.getState().kanban.reviewTask('3', 'DONE')

    expect(update).toHaveBeenCalledWith('3', 'DONE', undefined)
    expect(useWorkflowStore.getState().kanban.reviewTasks.map((t) => t.id)).toEqual(['4'])
  })

  it('reviewTask trả lại không có lý do: không gọi API, task vẫn ở hàng chờ', async () => {
    useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, reviewTasks: [task('3')], pendingTaskIds: [] } }))
    const update = vi.spyOn(workflowService, 'updateTaskStatus')

    await useWorkflowStore.getState().kanban.reviewTask('3', 'IN_PROGRESS', '  ')

    expect(update).not.toHaveBeenCalled()
    expect(useWorkflowStore.getState().kanban.reviewTasks).toHaveLength(1)
  })

  it('API lỗi: task vẫn ở hàng chờ, hết trạng thái chờ', async () => {
    useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, reviewTasks: [task('3')], pendingTaskIds: [] } }))
    vi.spyOn(workflowService, 'updateTaskStatus').mockRejectedValue(new Error('409'))

    await useWorkflowStore.getState().kanban.reviewTask('3', 'DONE')

    expect(useWorkflowStore.getState().kanban.reviewTasks).toHaveLength(1)
    expect(useWorkflowStore.getState().kanban.pendingTaskIds).toEqual([])
  })
})

describe('kanban — nộp minh chứng (G17)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('nộp xong: tải lại kho Artifacts của dự án đang mở, thẻ giữ tên phase', async () => {
    const mine = { ...task('7', 'IN_PROGRESS'), phaseLabel: 'PHASE 3 · Cụm 3' }
    useWorkflowStore.setState((state) => ({
      kanban: { ...state.kanban, tasks: [mine] },
      artifacts: { ...state.artifacts, projectId: '26' },
    }))
    vi.spyOn(workflowService, 'submitTaskArtifact').mockResolvedValue({
      task: { ...mine, status: 'REVIEW', phaseLabel: '' },
      artifact: { id: '1', type: 'PR', url: 'https://github.com/x/y/pull/1', note: 'PR', uploadedAt: '2026-11-15T00:00:00Z' },
    })
    const reload = vi.spyOn(workflowService, 'getProjectArtifacts').mockResolvedValue([])

    const ok = await useWorkflowStore.getState().kanban.submitTaskArtifact('7', { type: 'PR', url: 'https://github.com/x/y/pull/1', name: 'PR' })

    expect(ok).toBe(true)
    expect(reload).toHaveBeenCalledWith('26')
    expect(useWorkflowStore.getState().kanban.tasks[0]).toMatchObject({ status: 'REVIEW', phaseLabel: 'PHASE 3 · Cụm 3' })
  })
})
