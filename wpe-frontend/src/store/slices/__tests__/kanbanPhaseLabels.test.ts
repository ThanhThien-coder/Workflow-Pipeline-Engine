// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useWorkflowStore } from '../../useWorkflowStore'
import { workflowService } from '../../../services/container'
import type { KanbanTask } from '../../../types/kanban.types'
import type { MacroPhase } from '../../../types/workflow.types'

/** G13 — My Tasks gắn tên phase thật cho task theo id phase thật. */

function task(id: string, phaseId: string): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status: 'TODO', assignedUserId: '9', phaseId, phaseLabel: '',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

const PHASE: MacroPhase = {
  id: '56', name: 'PHASE 4', sub: 'Cụm công việc 4', status: 'TODO', pct: 0, accent: 'slate', w: 380, h: 180, parentPhaseIds: [],
}

describe('kanban.loadTasks — tên phase thật', () => {
  afterEach(() => vi.restoreAllMocks())

  it('gắn "TÊN · phụ đề" của phase cho task; phase không tìm thấy thì giữ nhãn cũ', async () => {
    vi.spyOn(workflowService, 'getMyTasks').mockResolvedValue([task('1', '56'), { ...task('2', '99'), phaseLabel: 'Nhãn cũ' }])
    const getMacroPhases = vi.spyOn(workflowService, 'getMacroPhases').mockResolvedValue([PHASE])
    useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, currentUserId: '9' } }))

    await useWorkflowStore.getState().kanban.loadTasks('19')

    expect(getMacroPhases).toHaveBeenCalledWith('19')
    expect(useWorkflowStore.getState().kanban.tasks.map((t) => [t.phaseId, t.phaseLabel])).toEqual([
      ['56', 'PHASE 4 · Cụm công việc 4'],
      ['99', 'Nhãn cũ'],
    ])
  })
})
