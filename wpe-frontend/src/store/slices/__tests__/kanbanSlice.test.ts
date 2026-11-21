// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKanbanSlice } from '../kanbanSlice'
import { workflowService } from '../../../services/container'
import type { KanbanTask } from '../../../types/kanban.types'

function makeTask(): KanbanTask {
  return {
    id: 'task-1',
    code: 'WPE-001',
    title: 'Task 1',
    description: '',
    status: 'IN_PROGRESS',
    assignedUserId: '1',
    phaseId: 'p1',
    phaseLabel: 'Phase 1',
    dueDate: '',
    isOverdue: false,
    joinPolicySummary: 'None',
    artifacts: [],
    version: 1,
  }
}

describe('kanbanSlice submit artifact without type', () => {
  afterEach(() => vi.restoreAllMocks())

  it('submitTaskArtifact và submitArtifact hoạt động khi không truyền type', async () => {
    const task = makeTask()
    const updatedTask: KanbanTask = { ...task, status: 'REVIEW' }
    const spy = vi.spyOn(workflowService, 'submitTaskArtifact').mockResolvedValue({
      task: updatedTask,
      artifact: {
        id: 'art-1',
        type: 'FIGMA',
        url: 'https://figma.com/file/x',
        note: 'Design link',
        uploadedAt: '2026-11-21T00:00:00Z',
      },
    })

    let state = createKanbanSlice(
      (updater) => {
        state = updater(state)
      },
      () => state,
    )
    state.kanban.tasks = [task]
    state.kanban.submittingTaskId = 'task-1'
    state.kanban.isSubmitModalOpen = true

    const ok1 = await state.kanban.submitTaskArtifact('task-1', {
      url: 'https://figma.com/file/x',
      name: 'Design link',
    })
    expect(ok1).toBe(true)
    expect(spy).toHaveBeenCalledWith({
      taskId: 'task-1',
      url: 'https://figma.com/file/x',
      name: 'Design link',
    })

    state.kanban.tasks = [task]
    state.kanban.submittingTaskId = 'task-1'
    const ok2 = await state.kanban.submitArtifact({
      url: 'https://github.com/org/repo/pull/5',
      name: 'PR link',
    })
    expect(ok2).toBe(true)
    expect(spy).toHaveBeenLastCalledWith({
      taskId: 'task-1',
      url: 'https://github.com/org/repo/pull/5',
      name: 'PR link',
    })
  })
})
