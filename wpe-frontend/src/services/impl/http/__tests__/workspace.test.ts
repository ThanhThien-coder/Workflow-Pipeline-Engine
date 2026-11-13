// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchProjects, setProjectStatus } from '../workspace'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204 || body === undefined || body === null) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Call = { method: string; url: string; body: unknown }

describe('D1: workspace API (impl/http/workspace.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let calls: Call[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls = []
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({
        method,
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      if (method === 'GET' && String(url).includes('/projects')) {
        return jsonResponse(200, [
          {
            id: 1,
            name: 'Archived Pipeline',
            description: 'Test archived project',
            status: 'ARCHIVED',
            ownerId: 1,
            ownerName: 'Alex Kim',
            nodeCount: 10,
            activeNodes: 0,
            doneNodes: 10,
            totalNodes: 10,
            completedNodes: 10,
            inProgressNodes: 0,
          },
        ])
      }
      if (method === 'PATCH' && String(url).includes('/status')) {
        const bodyObj = init?.body ? JSON.parse(String(init.body)) : {}
        return jsonResponse(200, {
          id: 1,
          name: 'Archived Pipeline',
          status: bodyObj.status || 'ACTIVE',
          ownerId: 1,
          ownerName: 'Alex Kim',
          totalNodes: 10,
          completedNodes: 10,
        })
      }
      if (method === 'DELETE' && /\/projects\/\d+$/.test(String(url))) {
        return jsonResponse(204)
      }
      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'Not found' })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('archiveProject, restoreProject, deleteProject không còn nằm trong METHODS_STILL_MOCKED', () => {
    expect(METHODS_STILL_MOCKED).not.toContain('archiveProject')
    expect(METHODS_STILL_MOCKED).not.toContain('restoreProject')
    expect(METHODS_STILL_MOCKED).not.toContain('deleteProject')
  })

  it('fetchProjects({tab:\'archived\',sort:\'done\'}) gọi đúng URL /projects?tab=archived&sort=done', async () => {
    const projects = await fetchProjects({ tab: 'archived', sort: 'done' })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toContain('/projects?tab=archived&sort=done')
    expect(projects).toHaveLength(1)
    expect(projects[0].id).toBe('1')
    expect(projects[0].status).toBe('ARCHIVED')
    expect(projects[0].nodeCount).toBe(10)
    expect(projects[0].completedNodes).toBe(10)
  })

  it('setProjectStatus gửi PATCH đúng body và URL', async () => {
    await setProjectStatus('42', 'ARCHIVED')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toMatch(/\/projects\/42\/status$/)
    expect(calls[0].body).toEqual({ status: 'ARCHIVED' })
  })

  it('HttpWorkflowService.archiveProject và restoreProject gọi backend qua setProjectStatus', async () => {
    const svc = new HttpWorkflowService()

    const archived = await svc.archiveProject('1')
    expect(calls.some((c) => c.method === 'PATCH' && c.body && (c.body as any).status === 'ARCHIVED')).toBe(true)
    expect(archived.status).toBe('ARCHIVED')

    const restored = await svc.restoreProject('1')
    expect(calls.some((c) => c.method === 'PATCH' && c.body && (c.body as any).status === 'ACTIVE')).toBe(true)
    expect(restored.status).toBe('ACTIVE')
  })

  it('HttpWorkflowService.deleteProject gọi DELETE /projects/{id}', async () => {
    const svc = new HttpWorkflowService()

    await svc.deleteProject('42')

    expect(calls.some((c) => c.method === 'DELETE' && /\/projects\/42$/.test(c.url))).toBe(true)
  })

  it('HttpWorkflowService.restoreProject giữ nguyên status DRAFT nếu backend trả DRAFT', async () => {
    fetchMock.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      return jsonResponse(200, {
        id: 1,
        name: 'Draft Pipeline',
        status: 'DRAFT',
        ownerId: 1,
        ownerName: 'Alex Kim',
        totalNodes: 0,
        completedNodes: 0,
      })
    })
    const svc = new HttpWorkflowService()

    const restored = await svc.restoreProject('1')
    expect(calls.some((c) => c.method === 'PATCH' && c.body && (c.body as any).status === 'ACTIVE')).toBe(true)
    expect(restored.status).toBe('DRAFT')
  })
})
