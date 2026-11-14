import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpNotificationService } from '../HttpNotificationService'
import * as apiClient from '../../http/apiClient'

describe('HttpNotificationService (FC3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('list calls GET /notifications and GET /notifications/unread-count and maps invitation deep-link', async () => {
    const apiSpy = vi.spyOn(apiClient, 'apiRequest').mockImplementation(async (_method, path) => {
      if (path === '/notifications') {
        return [
          {
            id: '501',
            title: 'Lời mời tham gia dự án: Core Banking Pipeline',
            message: 'Alex Kim đã mời bạn tham gia dự án "Core Banking Pipeline"',
            linkUrl: '/workspace?action=open-invite-modal&invitationId=77',
            isRead: false,
            createdAt: '2026-11-13T10:00:00Z',
          },
        ] as any
      }
      if (path === '/notifications/unread-count') {
        return { unreadCount: 1 } as any
      }
      return undefined as any
    })

    const service = new HttpNotificationService()
    const res = await service.list(30)

    expect(apiSpy).toHaveBeenCalledWith('GET', '/notifications', {
      query: { unreadOnly: false, limit: 30 },
    })
    expect(apiSpy).toHaveBeenCalledWith('GET', '/notifications/unread-count')
    expect(res.unreadCount).toBe(1)
    expect(res.items).toHaveLength(1)
    expect(res.items[0].id).toBe('501')
    expect(res.items[0].kind).toBe('invitation')
    expect(res.items[0].linkUrl).toBe('/workspace?action=open-invite-modal&invitationId=77')
    expect(res.items[0].targetPath).toBe('/workspace?action=open-invite-modal&invitationId=77')
  })

  it('markAsRead calls PATCH /notifications/{id}/read', async () => {
    const apiSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
      id: '501',
      title: 'Lời mời tham gia dự án',
      message: 'Alex Kim đã mời bạn',
      linkUrl: '/workspace?action=open-invite-modal&invitationId=77',
      isRead: true,
      createdAt: '2026-11-13T10:00:00Z',
    })

    const service = new HttpNotificationService()
    const dto = await service.markAsRead('501')

    expect(apiSpy).toHaveBeenCalledWith('PATCH', '/notifications/501/read')
    expect(dto.isRead).toBe(true)
  })

  it('markAllAsRead calls PATCH /notifications/read-all', async () => {
    const apiSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({ success: true })

    const service = new HttpNotificationService()
    await service.markAllAsRead()

    expect(apiSpy).toHaveBeenCalledWith('PATCH', '/notifications/read-all')
  })
})
