// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWorkflowStore } from '../../useWorkflowStore'
import { workflowService } from '../../../services/container'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

/** Mở lại task trong My Tasks: task con của chính mình bị khóa lại phải hiện Locked ngay, không nháy danh sách. */

function task(id: string, status: KanbanTask['status'], phaseLabel = 'Build'): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId: '9', phaseId: '56', phaseLabel,
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}
const OWNER: UserSummary = { id: '9', name: 'o', roleTitle: '', initials: 'O', avatarClass: 'bg-slate-300', projectRole: 'OWNER', assignedTaskCount: 0 }
const svc = workflowService as unknown as { reopenTask?: unknown }
const original = svc.reopenTask

describe('kanban.reopenTask (My Tasks)', () => {
  beforeEach(() => {
    useWorkflowStore.setState((state) => ({
      currentProjectId: '19',
      kanban: { ...state.kanban, currentUserId: '9', members: [OWNER], tasks: [task('1', 'DONE'), task('2', 'TODO')], pendingTaskIds: [], status: 'ready' },
    }))
  })
  afterEach(() => {
    svc.reopenTask = original
    vi.restoreAllMocks()
  })

  it('xong thì tải lại ngầm: task con bị khóa lại hiện LOCKED, giữ nhãn phase, không chuyển sang loading', async () => {
    svc.reopenTask = vi.fn(async () => task('1', 'IN_PROGRESS', ''))
    let statusDuringRefresh: string | null = null
    const getMyTasks = vi.spyOn(workflowService, 'getMyTasks').mockImplementation(async () => {
      statusDuringRefresh = useWorkflowStore.getState().kanban.status
      return [task('1', 'IN_PROGRESS', ''), task('2', 'LOCKED', '')]
    })

    const ok = await useWorkflowStore.getState().kanban.reopenTask('1', 'Sai yêu cầu')

    expect(ok).toBe(true)
    expect(getMyTasks).toHaveBeenCalledWith('19', '9')
    expect(statusDuringRefresh).toBe('ready')
    const tasks = useWorkflowStore.getState().kanban.tasks
    expect(tasks.find((t) => t.id === '1')?.status).toBe('IN_PROGRESS')
    expect(tasks.find((t) => t.id === '2')?.status).toBe('LOCKED')
    expect(tasks.every((t) => t.phaseLabel === 'Build')).toBe(true)
  })

  it('tải lại ngầm lỗi: vẫn báo mở lại thành công, giữ danh sách đã cập nhật', async () => {
    svc.reopenTask = vi.fn(async () => task('1', 'IN_PROGRESS'))
    vi.spyOn(workflowService, 'getMyTasks').mockRejectedValue(new Error('network'))

    const ok = await useWorkflowStore.getState().kanban.reopenTask('1', 'Sai yêu cầu')

    expect(ok).toBe(true)
    expect(useWorkflowStore.getState().kanban.tasks.find((t) => t.id === '1')?.status).toBe('IN_PROGRESS')
  })
})
