// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService } from '../HttpWorkflowService'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const GRAPH = {
  phases: [{ id: 20, name: 'Old name', parentPhaseIds: [] }, { id: 21, name: 'Second', parentPhaseIds: [20] }],
  phaseEdges: [[20, 21]],
  nodes: [{ id: 5, phaseId: 20, code: 'N5', title: 'A' }, { id: 6, phaseId: 21, code: 'N6', title: 'B' }],
  dependencies: [{ parentNodeId: 5, childNodeId: 6 }],
}

describe('HttpWorkflowService: dữ liệu đồ thị (TASK_69)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const calls = () => fetchMock.mock.calls.map((c) => ({ url: String(c[0]), init: (c[1] ?? {}) as RequestInit }))

  it('getProjectGraph chỉ gọi 1 lần GET /graph và dựng cây mọi phase', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, GRAPH))
    const res = await new HttpWorkflowService().getProjectGraph('7')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls()[0].url).toMatch(/\/projects\/7\/graph$/)
    expect(res.phases.map((p) => p.id)).toEqual(['20', '21'])
    expect(res.edges).toEqual([['20', '21']])
    expect(Object.keys(res.trees)).toEqual(['20', '21'])
    expect(Object.values(res.trees['21']).some((n) => n.kind === 'ghost')).toBe(true)
  })

  it('renamePhase gửi PUT chỉ có name và cập nhật phaseIndex (lần lưu vị trí sau gửi tên mới)', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).endsWith('/graph')) return jsonResponse(200, GRAPH)
      return jsonResponse(200, { id: 20, name: JSON.parse(String(init.body)).name })
    })
    const service = new HttpWorkflowService()
    await service.getProjectGraph('7')
    await service.renamePhase('20', 'New name', '7')

    const put = calls().find((c) => c.init.method === 'PUT')!
    expect(put.url).toMatch(/\/projects\/7\/phases\/20$/)
    expect(JSON.parse(String(put.init.body))).toEqual({ name: 'New name' })

    await service.updatePhasePosition('20', { x: 10, y: 20 }, '7')
    const puts = calls().filter((c) => c.init.method === 'PUT')
    expect(JSON.parse(String(puts[1].init.body)).name).toBe('New name')
  })

  it('deleteDependency gọi DELETE /projects/7/dependencies?parentNodeId=5&childNodeId=6', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/graph') ? jsonResponse(200, GRAPH) : jsonResponse(204, null))
    const service = new HttpWorkflowService()
    await service.getProjectGraph('7')
    await service.deleteDependency('21', '5', '6')
    const del = calls().find((c) => c.init.method === 'DELETE')!
    expect(del.url).toMatch(/\/projects\/7\/dependencies\?/)
    expect(del.url).toContain('parentNodeId=5')
    expect(del.url).toContain('childNodeId=6')
  })

  it('createProject và cloneTemplate không gửi visibility', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { id: 1, name: 'P' }))
    const service = new HttpWorkflowService()
    await service.createProject({ name: 'P', visibility: 'PUBLIC' } as never)
    await service.cloneTemplate({ templateId: 'tpl-sdlc', projectName: 'P', visibility: 'PUBLIC' } as never)
    const withBody = calls().filter((c) => c.init.body)
    expect(withBody.length).toBe(2)
    for (const c of withBody) {
      expect(JSON.parse(String(c.init.body))).not.toHaveProperty('visibility')
    }
  })
})
