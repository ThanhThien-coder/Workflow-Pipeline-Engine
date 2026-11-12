// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  changeRole,
  createInvitation,
  listMemberHistory,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from '../members'
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

describe('D2: members API (impl/http/members.ts)', () => {
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

      if (method === 'GET' && String(url).endsWith('/projects/7/members')) {
        return jsonResponse(200, [
          {
            userId: 1,
            username: 'alex.kim',
            fullName: 'Alex Kim',
            email: 'alex.kim@pipeline.engine',
            role: 'OWNER',
            joinedAt: '2026-10-01T00:00:00Z',
            activeNodeCount: 3,
            initials: 'AK',
            avatarUrl: null,
          },
          {
            userId: 2,
            username: 'sarah.chen',
            fullName: 'Sarah Chen',
            email: 'sarah.chen@pipeline.engine',
            role: 'COLLABORATOR',
            joinedAt: '2026-10-05T00:00:00Z',
            activeNodeCount: 2,
            initials: 'SC',
            avatarUrl: null,
          },
        ])
      }

      if (method === 'PATCH' && String(url).endsWith('/projects/7/members/2')) {
        return jsonResponse(200, {
          userId: 2,
          username: 'sarah.chen',
          fullName: 'Sarah Chen',
          email: 'sarah.chen@pipeline.engine',
          role: 'OWNER',
          joinedAt: '2026-10-05T00:00:00Z',
          activeNodeCount: 2,
          initials: 'SC',
          avatarUrl: null,
        })
      }

      if (method === 'DELETE' && String(url).endsWith('/projects/7/members/2')) {
        return jsonResponse(200, {
          userId: 2,
          unassignedTaskCount: 2,
        })
      }

      if (method === 'GET' && String(url).endsWith('/projects/7/members/history')) {
        return jsonResponse(200, [
          {
            userId: 1,
            username: 'alex.kim',
            fullName: 'Alex Kim',
            role: 'OWNER',
            joinedAt: '2026-10-01T00:00:00Z',
            removedAt: null,
            active: true,
          },
          {
            userId: 3,
            username: 'marcus.liu',
            fullName: 'Marcus Liu',
            role: 'VIEWER',
            joinedAt: '2026-09-01T00:00:00Z',
            removedAt: '2026-09-20T00:00:00Z',
            active: false,
          },
        ])
      }

      if (method === 'POST' && String(url).endsWith('/projects/7/invitations')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        if (body.inviteeEmailOrUsername === 'conflict@pipeline.engine') {
          return jsonResponse(409, {
            status: 409,
            error: 'INVITATION_ALREADY_PENDING',
            message: 'Đã có lời mời đang chờ phản hồi',
          })
        }
        return jsonResponse(201, {
          id: 101,
          projectId: 7,
          projectName: 'FinTech Core',
          inviterId: 1,
          inviterName: 'Alex Kim',
          inviteeId: 5,
          inviteeEmail: body.inviteeEmailOrUsername,
          role: body.role || 'COLLABORATOR',
          status: 'PENDING',
          createdAt: '2026-10-21T10:00:00Z',
          expiresAt: '2026-10-28T10:00:00Z',
          version: 0,
        })
      }

      if (method === 'GET' && String(url).endsWith('/projects/7/invitations')) {
        return jsonResponse(200, [
          {
            id: 101,
            projectId: 7,
            projectName: 'FinTech Core',
            inviterId: 1,
            inviterName: 'Alex Kim',
            inviteeEmail: 'pending@pipeline.engine',
            role: 'COLLABORATOR',
            status: 'PENDING',
            createdAt: '2026-10-21T10:00:00Z',
            expiresAt: '2026-10-28T10:00:00Z',
            version: 0,
          },
        ])
      }

      if (method === 'DELETE' && String(url).endsWith('/projects/7/invitations/101')) {
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

  it('thành viên và lời mời không còn nằm trong METHODS_STILL_MOCKED', () => {
    const list: readonly string[] = METHODS_STILL_MOCKED
    expect(list).not.toContain('getProjectMembersDetailed')
    expect(list).not.toContain('inviteProjectMember')
    expect(list).not.toContain('changeMemberRole')
    expect(list).not.toContain('removeProjectMember')
    expect(list).not.toContain('createProjectInvitation')
    expect(list).not.toContain('getProjectPendingInvitations')
    expect(list).not.toContain('revokeInvitation')
  })

  it('listMembers gọi GET /projects/7/members và map đầy đủ thông tin thành viên', async () => {
    const members = await listMembers(7)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toMatch(/\/projects\/7\/members$/)
    expect(members).toHaveLength(2)
    expect(members[0]).toMatchObject({
      userId: '1',
      username: 'alex.kim',
      email: 'alex.kim@pipeline.engine',
      role: 'OWNER',
      activeNodeCount: 3,
      initials: 'AK',
    })
    expect(members[0].avatarClass).toBeDefined()
    expect(members[1]).toMatchObject({
      userId: '2',
      username: 'sarah.chen',
      role: 'COLLABORATOR',
      activeNodeCount: 2,
    })
  })

  it('changeRole OWNER gửi PATCH /projects/7/members/2 với đúng body { role: \'OWNER\' }', async () => {
    const updated = await changeRole(7, 2, 'OWNER')

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toMatch(/\/projects\/7\/members\/2$/)
    expect(calls[0].body).toEqual({ role: 'OWNER' })
    expect(updated).toMatchObject({
      userId: '2',
      role: 'OWNER',
    })
  })

  it('removeMember gọi DELETE /projects/7/members/2 và trả unassignedTaskCount', async () => {
    const res = await removeMember(7, 2)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].url).toMatch(/\/projects\/7\/members\/2$/)
    expect(res.unassignedTaskCount).toBe(2)
  })

  it('listMemberHistory gọi GET /projects/7/members/history và map đúng thuộc tính active (boolean)', async () => {
    const history = await listMemberHistory(7)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toMatch(/\/projects\/7\/members\/history$/)
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      userId: '1',
      username: 'alex.kim',
      fullName: 'Alex Kim',
      role: 'OWNER',
      active: true,
      removedAt: null,
    })
    expect(history[1]).toMatchObject({
      userId: '3',
      username: 'marcus.liu',
      role: 'VIEWER',
      active: false,
    })
    expect(history[1].removedAt).not.toBeNull()
  })

  it('createInvitation gặp 409 trả ApiError với mã code INVITATION_ALREADY_PENDING', async () => {
    await expect(
      createInvitation(7, {
        usernameOrEmail: 'conflict@pipeline.engine',
        role: 'COLLABORATOR',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_PENDING',
    })
  })

  it('HttpWorkflowService tích hợp các method thành viên và lời mời gọi API thật', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const urlStr = String(url)
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, url: urlStr, body: parsedBody })

      if (method === 'GET' && urlStr.endsWith('/projects/7/members/history')) {
        return jsonResponse(200, [
          {
            userId: 1,
            username: 'alex.kim',
            fullName: 'Alex Kim',
            role: 'OWNER',
            joinedAt: '2026-10-01T00:00:00Z',
            removedAt: null,
            active: true,
          },
          {
            userId: 3,
            username: 'marcus.liu',
            fullName: 'Marcus Liu',
            role: 'VIEWER',
            joinedAt: '2026-09-01T00:00:00Z',
            removedAt: '2026-09-20T00:00:00Z',
            active: false,
          },
        ])
      }

      if (method === 'GET' && urlStr.endsWith('/projects/7/members')) {
        return jsonResponse(200, [
          {
            userId: 1,
            username: 'alex.kim',
            fullName: 'Alex Kim',
            email: 'alex.kim@pipeline.engine',
            role: 'OWNER',
            joinedAt: '2026-10-01T00:00:00Z',
            activeNodeCount: 3,
            initials: 'AK',
            avatarUrl: null,
          },
          {
            userId: 2,
            username: 'sarah.chen',
            fullName: 'Sarah Chen',
            email: 'sarah.chen@pipeline.engine',
            role: 'COLLABORATOR',
            joinedAt: '2026-10-05T00:00:00Z',
            activeNodeCount: 2,
            initials: 'SC',
            avatarUrl: null,
          },
        ])
      }

      if (method === 'PATCH' && urlStr.endsWith('/projects/7/members/2')) {
        return jsonResponse(200, {
          userId: 2,
          username: 'sarah.chen',
          fullName: 'Sarah Chen',
          email: 'sarah.chen@pipeline.engine',
          role: parsedBody?.role || 'OWNER',
          joinedAt: '2026-10-05T00:00:00Z',
          activeNodeCount: 2,
          initials: 'SC',
          avatarUrl: null,
        })
      }

      if (method === 'DELETE' && urlStr.endsWith('/projects/7/members/2')) {
        return jsonResponse(200, {
          userId: 2,
          unassignedTaskCount: 2,
        })
      }

      if (method === 'GET' && urlStr.endsWith('/projects/7/invitations')) {
        return jsonResponse(200, [
          {
            id: 101,
            projectId: 7,
            projectName: 'FinTech Core',
            inviterId: 1,
            inviterName: 'Alex Kim',
            inviteeEmail: 'pending@pipeline.engine',
            role: 'COLLABORATOR',
            status: 'PENDING',
            createdAt: '2026-10-21T10:00:00Z',
            expiresAt: '2026-10-28T10:00:00Z',
            version: 0,
          },
        ])
      }

      if (method === 'DELETE' && urlStr.endsWith('/projects/7/invitations/101')) {
        return jsonResponse(204)
      }

      return jsonResponse(404, { status: 404, error: 'NOT_FOUND', message: 'Not found' })
    })

    const svc = new HttpWorkflowService()

    const members = await svc.getProjectMembersDetailed('7')
    expect(members).toHaveLength(2)

    const history = await svc.getProjectMemberHistory('7')
    expect(history).toHaveLength(2)

    const roleChanged = await svc.changeMemberRole('7', '2', { role: 'OWNER' })
    expect(roleChanged.role).toBe('OWNER')

    const removeResult = await svc.removeProjectMember('7', '2')
    expect(removeResult.unassignedTaskCount).toBe(2)

    const pending = await svc.getProjectPendingInvitations('7')
    expect(pending).toHaveLength(1)

    const revoked = await svc.revokeInvitation('7', '101')
    expect(revoked).toBe(true)
  })
})
