// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService } from '../../HttpWorkflowService'

/** T4 (G10) — Kanban theo phase gọi endpoint mới; task chưa giao không bị gán người mặc định. */

describe('HttpWorkflowService.getPhaseTasks', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: '11', phaseId: '56', code: 'WPE-011', title: 'Khóa', status: 'LOCKED', assignedUserId: null, joinPolicy: 'ALL_COMPLETED', isOverdue: false, version: 0 },
          { id: '12', phaseId: '56', code: 'WPE-012', title: 'Giao rồi', status: 'TODO', assignedUserId: '9', joinPolicy: 'ALL_COMPLETED', isOverdue: false, version: 3 },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('GET /projects/{id}/phases/{phaseId}/tasks; task chưa giao có assignedUserId rỗng (không phải "1")', async () => {
    const tasks = await new HttpWorkflowService().getPhaseTasks('19', '56')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/19/phases/56/tasks')
    expect(tasks.map((t) => [t.status, t.assignedUserId])).toEqual([['LOCKED', ''], ['TODO', '9']])
  })
})
