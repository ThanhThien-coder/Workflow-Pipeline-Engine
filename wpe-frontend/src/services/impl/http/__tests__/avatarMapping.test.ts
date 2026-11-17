// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../http/apiClient', () => ({
  apiRequest: vi.fn(),
  getStoredUserId: vi.fn(() => '1'),
}))

import { apiRequest } from '../../../http/apiClient'
import { fetchProjects } from '../workspace'
import { toUserSummary, mapMemberResponse } from '../members'
import { mapProjectActivities } from '../overview'
import { mapGuestOverviewResponse } from '../guest'
import { mapAdminUser } from '../../../admin/HttpAdminService'
import { mapProjectDtoToVm } from '../../../../mappers/projectMapper'

describe('TASK_55: các hàm map mang avatarUrl', () => {
  it('members.ts: mapMemberResponse và toUserSummary giữ avatarUrl, null khi không có', () => {
    const withAvatar = { userId: 2, username: 'alex', role: 'COLLABORATOR', avatarUrl: '/uploads/avatars/example-alex.png' }
    expect(mapMemberResponse(withAvatar).avatarUrl).toBe('/uploads/avatars/example-alex.png')
    expect(toUserSummary(withAvatar).avatarUrl).toBe('/uploads/avatars/example-alex.png')
    expect(toUserSummary({ userId: 3, username: 'sarah', role: 'VIEWER' }).avatarUrl).toBeNull()
  })

  it('overview.ts: mapProjectActivities đưa actorId và actorAvatarUrl vào actor', () => {
    const res = mapProjectActivities([
      {
        id: 'node-1-updated',
        type: 'TASK_STATUS_CHANGED',
        actorName: 'Alex Kim',
        message: 'x',
        targetCode: 'WPE-1',
        createdAt: '2026-11-10T08:00:00Z',
        actorId: '2',
        actorAvatarUrl: '/uploads/avatars/example-alex.png',
      },
      {
        id: 'feedback-1-created',
        type: 'FEEDBACK_CREATED',
        actorName: 'Khach A',
        message: 'y',
        targetCode: null,
        createdAt: '2026-11-10T09:00:00Z',
        actorId: null,
        actorAvatarUrl: null,
      },
    ])
    expect(res[0].actor.id).toBe('2')
    expect(res[0].actor.avatarUrl).toBe('/uploads/avatars/example-alex.png')
    expect(res[1].actor.id).toBeNull()
    expect(res[1].actor.avatarUrl).toBeFalsy()
  })

  it('workspace.ts: fetchProjects map members kèm avatarUrl và projectMapper đưa sang view-model', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([
      {
        id: 1,
        name: 'P1',
        ownerId: 1,
        ownerName: 'Alex Kim',
        members: [
          { id: 1, displayName: 'Alex Kim', avatarUrl: '/uploads/avatars/example-alex.png' },
          { id: 2, displayName: 'Sarah Chen', avatarUrl: null },
        ],
      },
    ])
    const projects = await fetchProjects()
    expect(projects[0].members[0].avatarUrl).toBe('/uploads/avatars/example-alex.png')
    expect(projects[0].members[1].avatarUrl).toBeNull()

    const vm = mapProjectDtoToVm(projects[0])
    expect(vm.members).toEqual([
      { name: 'Alex Kim', avatarUrl: '/uploads/avatars/example-alex.png' },
      { name: 'Sarah Chen', avatarUrl: null },
    ])
  })

  it('HttpAdminService.mapAdminUser giữ avatarUrl', () => {
    expect(mapAdminUser({ id: 1, name: 'A', avatarUrl: '/uploads/avatars/example-a.png' }).avatarUrl).toBe('/uploads/avatars/example-a.png')
    expect(mapAdminUser({ id: 2, name: 'B' }).avatarUrl).toBeNull()
  })

  it('guest.ts: mapGuestOverviewResponse giữ avatarUrl của hoạt động', () => {
    const dto = mapGuestOverviewResponse({
      recentActivity: [
        { id: 'node-1', actor: 'WPE-1', text: 't', ago: '1 min ago', avatarUrl: '/uploads/avatars/example-alex.png' },
        { id: 'node-2', actor: 'WPE-2', text: 't', ago: '2 min ago' },
      ],
    })
    expect(dto.recentActivity[0].avatarUrl).toBe('/uploads/avatars/example-alex.png')
    expect(dto.recentActivity[1].avatarUrl).toBeNull()
  })
})
