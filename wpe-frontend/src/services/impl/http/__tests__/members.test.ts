// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'

/** T1 (G9) — thành viên dự án lấy từ GET /projects/{id}/members, không còn người giả. */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('HttpWorkflowService.getProjectMembers', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('không còn nằm trong METHODS_STILL_MOCKED', () => {
    expect(METHODS_STILL_MOCKED as readonly string[]).not.toContain('getProjectMembers')
  })

  it('gọi GET /projects/{id}/members và đổi sang UserSummary (tên hiển thị ưu tiên fullName)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { userId: 9, username: 'a', fullName: 'Nguyễn A', role: 'OWNER', activeNodeCount: 2, initials: 'NA', avatarUrl: null },
        { userId: 3, username: 'sarah.chen', fullName: null, role: 'COLLABORATOR', activeNodeCount: 0 },
      ]),
    )

    const members = await new HttpWorkflowService().getProjectMembers('19')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/19/members')
    expect(members).toHaveLength(2)
    expect(members[0]).toMatchObject({ id: '9', name: 'Nguyễn A', initials: 'NA', projectRole: 'OWNER', assignedTaskCount: 2 })
    expect(members[1]).toMatchObject({ id: '3', name: 'sarah.chen', initials: 'SA', projectRole: 'COLLABORATOR' })
  })

  it('backend lỗi thì ném lỗi, không trả người giả', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { status: 403, error: 'ACCESS_DENIED', message: 'Không phải thành viên' }))

    await expect(new HttpWorkflowService().getProjectMembers('19')).rejects.toMatchObject({ status: 403 })
  })
})
