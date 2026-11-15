// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService } from '../../HttpWorkflowService'

/** T3 (G7, G8) — thêm subtask, sửa, xóa task đều gọi API thật. */

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Dự án 7, PHASE 2 (id 20) có task WPE-002 (id 2, version 4) và WPE-005 (id 5)
const GRAPH = {
  phases: [{ id: '20', name: 'PHASE 2', orderIndex: 0, parentPhaseIds: [], uiMetadata: {} }],
  phaseEdges: [],
  nodes: [
    { id: '2', phaseId: '20', code: 'WPE-002', title: 'Thiết kế API', status: 'TODO', version: 4 },
    { id: '5', phaseId: '20', code: 'WPE-005', title: 'Thiết kế DB', status: 'TODO', version: 0 },
  ],
  dependencies: [],
}

type Call = { method: string; url: string; body: any }

describe('HttpWorkflowService: ghi task qua API', () => {
  let calls: Call[]
  let failDependency: boolean

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    failDependency = false
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const path = String(url)
      calls.push({ method, url: path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (method === 'GET' && path.endsWith('/projects/7/graph')) return jsonResponse(200, GRAPH)
      if (method === 'POST' && path.endsWith('/projects/7/nodes')) {
        return jsonResponse(201, { id: '9', phaseId: '20', code: 'WPE-009', title: 'Subtask', status: 'LOCKED', version: 0 })
      }
      if (method === 'POST' && path.endsWith('/projects/7/dependencies')) {
        return failDependency
          ? jsonResponse(422, { status: 422, error: 'CYCLE_DETECTED', message: 'Tạo chu trình' })
          : jsonResponse(201, {})
      }
      if (method === 'PUT' && path.endsWith('/nodes/2')) return jsonResponse(200, { ...GRAPH.nodes[0], version: 5 })
      if (method === 'DELETE' && path.endsWith('/nodes/9')) return jsonResponse(204)
      if (method === 'DELETE' && path.endsWith('/nodes/2')) return jsonResponse(204)
      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'không có' })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function serviceWithGraph() {
    const service = new HttpWorkflowService()
    await service.getPhaseGraph('20', '7')
    calls = []
    return service
  }

  it('addChildTask: tạo node trong phase rồi nối từ task cha, trả id và mã thật', async () => {
    const service = await serviceWithGraph()

    const created = await service.addChildTask('20', ['2'], { title: '  Subtask  ' })

    expect(calls.map((c) => `${c.method} ${c.url.replace(/.*\/api\/v1/, '')}`)).toEqual([
      'POST /projects/7/nodes',
      'POST /projects/7/dependencies',
    ])
    expect(calls[0].body).toEqual({ phaseId: 20, title: 'Subtask' })
    expect(calls[1].body).toEqual({ parentNodeId: 2, childNodeId: 9 })
    expect(created.id).toBe('9')
  })

  it('addChildTask nhiều cha (task hội tụ): nối đủ từ mọi task cha', async () => {
    const service = await serviceWithGraph()

    await service.addChildTask('20', ['2', '5'], { title: 'Converged' })

    expect(calls.filter((c) => c.url.endsWith('/dependencies')).map((c) => c.body)).toEqual([
      { parentNodeId: 2, childNodeId: 9 },
      { parentNodeId: 5, childNodeId: 9 },
    ])
  })

  it('addChildTask: nối lỗi thì xóa node vừa tạo và ném lỗi, không để lại task mồ côi', async () => {
    const service = await serviceWithGraph()
    failDependency = true

    await expect(service.addChildTask('20', ['2'], { title: 'X' })).rejects.toMatchObject({ status: 422 })
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/nodes/9'))).toBe(true)
  })

  it('addChildTask: task cha chưa lưu (id tạm) thì báo lỗi, không tạo node', async () => {
    const service = await serviceWithGraph()

    await expect(service.addChildTask('20', ['task-123'], { title: 'X' })).rejects.toMatchObject({ code: 'NODE_NOT_SAVED' })
    expect(calls).toHaveLength(0)
  })

  it('updateTaskNode: PUT /nodes/{id} kèm version đang giữ, ngày ISO, id người làm dạng số', async () => {
    const service = await serviceWithGraph()

    await service.updateTaskNode('2', {
      title: 'Tên mới', description: 'Mô tả', joinPolicy: 'ANY_COMPLETED', assigneeId: '9', dueDate: '2026-11-20',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].body).toEqual({
      title: 'Tên mới', description: 'Mô tả', joinPolicy: 'ANY_COMPLETED', version: 4,
      assignedUserId: 9, dueDate: '2026-11-20T00:00:00Z',
    })
  })

  it('updateTaskNode: bỏ người làm và hạn chót thì gửi clearAssignee, clearDueDate', async () => {
    const service = await serviceWithGraph()

    await service.updateTaskNode('2', { title: 'X', description: '', joinPolicy: 'ALL_COMPLETED', assigneeId: null, dueDate: null })

    expect(calls[0].body).toMatchObject({ clearAssignee: true, clearDueDate: true })
    expect(calls[0].body.assignedUserId).toBeUndefined()
    expect(calls[0].body.dueDate).toBeUndefined()
  })

  it('updateTaskNode: lần sửa thứ hai dùng version mới backend trả về', async () => {
    const service = await serviceWithGraph()
    const patch = { title: 'X', description: '', joinPolicy: 'ALL_COMPLETED' as const, assigneeId: null, dueDate: null }

    await service.updateTaskNode('2', patch)
    await service.updateTaskNode('2', patch)

    expect(calls.map((c) => c.body.version)).toEqual([4, 5])
  })

  it('deleteTaskNode: DELETE /nodes/{id}', async () => {
    const service = await serviceWithGraph()

    await service.deleteTaskNode('2')

    expect(calls.map((c) => `${c.method} ${c.url.replace(/.*\/api\/v1/, '')}`)).toEqual(['DELETE /nodes/2'])
  })
})

describe('HttpWorkflowService.forceUnlockTask (T6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('POST /nodes/{id}/force-unlock', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '2', code: 'WPE-002', title: 'X', status: 'TODO', version: 5, forceUnlockedAt: '2026-11-14T10:00:00Z' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await new HttpWorkflowService().forceUnlockTask('2')

    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/nodes\/2\/force-unlock$/)
  })
})
