// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'
import { AUTH_USER_KEY } from '../../../http/apiClient'

/**
 * getProjectSettings gọi backend thật (GET /projects/{id}), không còn trả dự án mock
 * "Marketing Campaign Q4" (id '1', DRAFT, OWNER) cho mọi dự án và mọi user.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Dự án 5 của alex (id 2), đang PLANNING; sarah (id 3) là COLLABORATOR
const DETAIL = {
  id: 5, name: 'Core Banking v2', description: 'Mô tả thật', status: 'PLANNING', ownerId: 2, ownerName: 'Alex Kim',
  totalNodes: 4, completedNodes: 1, inProgressNodes: 1, progressPercentage: 25,
  createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-12T09:30:00Z', latestAiAnalysis: null, phases: [],
}
const MEMBERS = [
  { userId: '2', username: 'alex.kim', role: 'OWNER' },
  { userId: '3', username: 'sarah.chen', role: 'COLLABORATOR' },
  { userId: '4', username: 'minh.tran', role: 'VIEWER' },
  { userId: '6', username: 'lan.pham', role: 'MANAGER' },
]

function loginAs(userId: number) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: String(userId), username: 'x' }))
}

describe('getProjectSettings gọi backend thật', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let urls: string[]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    urls = []
    fetchMock = vi.fn(async (url: string) => {
      urls.push(String(url))
      if (String(url).endsWith('/projects/5')) return jsonResponse(200, DETAIL)
      if (String(url).endsWith('/projects/5/members')) return jsonResponse(200, MEMBERS)
      return jsonResponse(404, { status: 404, error: 'RESOURCE_NOT_FOUND', message: 'Không tìm thấy dự án với ID: 99' })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('không còn nằm trong METHODS_STILL_MOCKED', () => {
    expect(METHODS_STILL_MOCKED).not.toContain('getProjectSettings')
  })

  it('owner (alex) xem dự án 5: đúng id, tên, mô tả, trạng thái thật; vai trò OWNER; không cần gọi danh sách thành viên', async () => {
    loginAs(2)
    const s = await new HttpWorkflowService().getProjectSettings('5')

    expect(s).toEqual({
      id: '5', name: 'Core Banking v2', description: 'Mô tả thật', status: 'PLANNING', ownerId: '2',
      myRole: 'OWNER', createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-12T09:30:00Z',
    })
    expect(urls.some((u) => u.endsWith('/projects/5'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/members'))).toBe(false)
  })

  it('sarah xem dự án 5: vai trò lấy từ danh sách thành viên (COLLABORATOR)', async () => {
    loginAs(3)
    const s = await new HttpWorkflowService().getProjectSettings('5')
    expect(s.myRole).toBe('COLLABORATOR')
    expect(urls.some((u) => u.endsWith('/projects/5/members'))).toBe(true)
  })

  it('thành viên MANAGER (PR #33): vai trò MANAGER', async () => {
    loginAs(6)
    expect((await new HttpWorkflowService().getProjectSettings('5')).myRole).toBe('MANAGER')
  })

  it('thành viên VIEWER: vai trò VIEWER', async () => {
    loginAs(4)
    expect((await new HttpWorkflowService().getProjectSettings('5')).myRole).toBe('VIEWER')
  })

  it('không phải owner, không có trong danh sách thành viên (ví dụ admin hệ thống): chỉ xem (VIEWER)', async () => {
    loginAs(1)
    expect((await new HttpWorkflowService().getProjectSettings('5')).myRole).toBe('VIEWER')
  })

  it('chưa đăng nhập (không biết mình là ai): chỉ xem (VIEWER), không tự nhận là OWNER', async () => {
    const s = await new HttpWorkflowService().getProjectSettings('5')
    expect(s.myRole).toBe('VIEWER')
  })

  it('dự án không tồn tại: ném ApiError 404, không trả dự án giả', async () => {
    loginAs(2)
    await expect(new HttpWorkflowService().getProjectSettings('99')).rejects.toMatchObject({
      status: 404, code: 'RESOURCE_NOT_FOUND',
    })
  })
})
