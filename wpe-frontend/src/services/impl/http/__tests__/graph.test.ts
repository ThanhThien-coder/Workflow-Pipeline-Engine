// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'

/**
 * B5 — Phần đồ thị của HttpWorkflowService gọi backend thật qua impl/http/graph.ts.
 * Không còn rơi về mock: lỗi thì ném ApiError để UI báo (toast, modal chu trình).
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Dự án 7: PHASE 1 (id 10) có WPE-001 (id 1), PHASE 2 (id 20) có WPE-002 (id 2)
const GRAPH = {
  phases: [
    { id: '10', name: 'PHASE 1', sub: 'Phân tích', orderIndex: 0, parentPhaseIds: [], status: 'TODO', progressPct: 0, uiMetadata: {} },
    { id: '20', name: 'PHASE 2', sub: 'Thiết kế', orderIndex: 1, parentPhaseIds: ['10'], status: 'LOCKED', progressPct: 0, uiMetadata: {} },
  ],
  phaseEdges: [['10', '20']],
  nodes: [
    { id: '1', phaseId: '10', code: 'WPE-001', title: 'Thu thập yêu cầu', status: 'TODO' },
    { id: '2', phaseId: '20', code: 'WPE-002', title: 'Thiết kế API', status: 'LOCKED' },
  ],
  dependencies: [],
}

type Call = { method: string; url: string; body: unknown }

describe('B5: phần đồ thị của HttpWorkflowService gọi API thật', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  const writes = () => calls.filter((c) => c.method !== 'GET')

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ method, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (method === 'GET' && String(url).endsWith('/projects/7/graph')) return jsonResponse(200, GRAPH)
      if (method === 'PUT') return jsonResponse(200, { ...GRAPH.phases[1] })
      if (method === 'POST' && String(url).endsWith('/projects/7/nodes')) {
        return jsonResponse(201, { id: '3', phaseId: '20', code: 'WPE-003', title: 'Viết tài liệu', status: 'LOCKED' })
      }
      if (method === 'POST' && String(url).endsWith('/projects/7/dependencies')) {
        return jsonResponse(201, { parentNodeId: '1', childNodeId: '2' })
      }
      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'không có' })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('updatePhasePosition, addRootTask, attachGhostNode không còn nằm trong METHODS_STILL_MOCKED', () => {
    expect(METHODS_STILL_MOCKED).not.toContain('updatePhasePosition')
    expect(METHODS_STILL_MOCKED).not.toContain('addRootTask')
    expect(METHODS_STILL_MOCKED).not.toContain('attachGhostNode')
  })

  it('updatePhasePosition gọi PUT /projects/7/phases/20 kèm tên phase và uiMetadata {x, y, w, h}', async () => {
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    await svc.updatePhasePosition('20', { x: 640, y: 210 }, '7')

    expect(writes()).toEqual([
      {
        method: 'PUT',
        url: expect.stringMatching(/\/projects\/7\/phases\/20$/),
        body: { name: 'PHASE 2', uiMetadata: { x: 640, y: 210, w: 380, h: 180 } },
      },
    ])
  })

  it('updatePhasePosition debounce 300ms: kéo 3 lần liên tiếp chỉ gửi 1 PUT với vị trí cuối', async () => {
    vi.useFakeTimers()
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    const p1 = svc.updatePhasePosition('20', { x: 100, y: 100 }, '7')
    await vi.advanceTimersByTimeAsync(100)
    const p2 = svc.updatePhasePosition('20', { x: 200, y: 150 }, '7')
    await vi.advanceTimersByTimeAsync(100)
    const p3 = svc.updatePhasePosition('20', { x: 300, y: 180 }, '7')
    expect(writes()).toHaveLength(0) // chưa đủ 300ms kể từ lần cuối
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([p1, p2, p3])

    expect(writes()).toHaveLength(1)
    expect(writes()[0].body).toMatchObject({ uiMetadata: { x: 300, y: 180 } })
  })

  it('updatePhasePosition: 2 phase khác nhau (Auto Layout) thì mỗi phase 1 PUT, không nuốt nhau', async () => {
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    await Promise.all([
      svc.updatePhasePosition('10', { x: 40, y: 140 }, '7'),
      svc.updatePhasePosition('20', { x: 400, y: 140 }, '7'),
    ])

    expect(writes().map((c) => c.url.split('/').pop())).toEqual(['10', '20'])
    expect(writes()[0].body).toMatchObject({ name: 'PHASE 1' })
  })

  it('updatePhasePosition chưa biết tên phase thì tự đọc đồ thị trước khi PUT (PUT bắt buộc có name)', async () => {
    const svc = new HttpWorkflowService()

    await svc.updatePhasePosition('20', { x: 1, y: 2 }, '7')

    expect(calls.map((c) => c.method)).toEqual(['GET', 'PUT'])
    expect(writes()[0].body).toMatchObject({ name: 'PHASE 2' })
  })

  it('updatePhasePosition: backend trả 403 thì ném ApiError ACCESS_DENIED, không giả vờ lưu thành công', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse(200, GRAPH)
      return jsonResponse(403, { status: 403, error: 'ACCESS_DENIED', message: 'Chỉ Chủ dự án mới có quyền' })
    })
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    await expect(svc.updatePhasePosition('20', { x: 1, y: 2 }, '7')).rejects.toMatchObject({ status: 403, code: 'ACCESS_DENIED' })
  })

  it('addRootTask gọi POST /projects/7/nodes với phaseId dạng số và tiêu đề', async () => {
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    const created = await svc.addRootTask('20', { title: '  Viết tài liệu  ' })

    expect(writes()).toEqual([
      { method: 'POST', url: expect.stringMatching(/\/projects\/7\/nodes$/), body: { phaseId: 20, title: 'Viết tài liệu' } },
    ])
    expect(created).toMatchObject({ id: '3', title: 'Viết tài liệu', status: 'LOCKED' })
  })

  it('attachGhostNode gọi POST /projects/7/dependencies: node nguồn là cha, node đích là con', async () => {
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    const dep = await svc.attachGhostNode('20', { sourcePhaseId: '10', sourceTaskId: '1', targetTaskId: '2' })

    expect(writes()).toEqual([
      { method: 'POST', url: expect.stringMatching(/\/projects\/7\/dependencies$/), body: { parentNodeId: 1, childNodeId: 2 } },
    ])
    expect(dep).toMatchObject({
      id: 'ghost_1_to_2', sourcePhaseId: '10', sourcePhaseTitle: 'PHASE 1', sourceTaskId: '1',
      sourceTaskTitle: 'Thu thập yêu cầu', targetTaskId: '2', status: 'LOCKED',
    })
  })

  it('attachGhostNode: nối tạo vòng (422) thì ném ApiError có cycleNodes để mở KahnCycleModal', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return jsonResponse(200, GRAPH)
      return jsonResponse(422, { status: 422, error: 'CYCLE_DETECTED', message: 'Tạo chu trình', cycleNodes: ['WPE-001', 'WPE-002'] })
    })
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    await expect(
      svc.attachGhostNode('20', { sourcePhaseId: '10', sourceTaskId: '1', targetTaskId: '2' })
    ).rejects.toMatchObject({ status: 422, code: 'CYCLE_DETECTED', cycleNodes: ['WPE-001', 'WPE-002'] })
  })

  it('attachGhostNode: id node không phải số (node mới tạo cục bộ, chưa lưu) thì báo lỗi rõ, không gọi API', async () => {
    const svc = new HttpWorkflowService()
    await svc.getMacroPhases('7')

    await expect(
      svc.attachGhostNode('20', { sourcePhaseId: '20', sourceTaskId: 'task-1731400000000', targetTaskId: '2' })
    ).rejects.toMatchObject({ code: 'NODE_NOT_SAVED' })
    expect(writes()).toHaveLength(0)
  })
})
