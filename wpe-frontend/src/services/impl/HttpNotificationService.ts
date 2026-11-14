import type { INotificationService } from '../contracts/INotificationService'
import type { NotificationDto, NotificationKind, NotificationListDto } from '../../types/notification.types'
import { apiRequest } from '../http/apiClient'

export interface BackendNotificationResponse {
  id: string | number
  title?: string | null
  message?: string | null
  linkUrl?: string | null
  isRead?: boolean | null
  createdAt?: string | null
}

export interface BackendUnreadCountResponse {
  unreadCount?: number
}

function inferNotificationKind(raw: BackendNotificationResponse): NotificationKind {
  const link = (raw.linkUrl || '').toLowerCase()
  const title = (raw.title || '').toLowerCase()
  const message = (raw.message || '').toLowerCase()

  if (link.includes('open-invite-modal') || link.includes('invitationid=') || title.includes('lời mời') || message.includes('mời bạn tham gia')) {
    return 'invitation'
  }
  if (title.includes('quá hạn') || title.includes('trễ hạn') || title.includes('overdue')) {
    return 'overdue'
  }
  if (title.includes('duyệt') || title.includes('nghiệm thu') || title.includes('approved')) {
    return 'approval'
  }
  if (title.includes('giao') || title.includes('assigned')) {
    return 'assignment'
  }
  return 'system'
}

export function mapBackendNotification(raw: BackendNotificationResponse): NotificationDto {
  const linkUrl = raw.linkUrl ?? ''
  const title = raw.title ?? ''
  const message = raw.message ?? title
  const text = message || title || ''

  return {
    id: String(raw.id),
    kind: inferNotificationKind(raw),
    actorName: null,
    text,
    title,
    message,
    linkUrl,
    targetPath: linkUrl,
    isRead: Boolean(raw.isRead),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  }
}

export class HttpNotificationService implements INotificationService {
  /** GET /notifications?unreadOnly=false&limit=30 + GET /notifications/unread-count */
  async list(limit = 30, unreadOnly = false): Promise<NotificationListDto> {
    const [rawList, rawUnread] = await Promise.all([
      apiRequest<BackendNotificationResponse[] | { items?: BackendNotificationResponse[]; unreadCount?: number }>(
        'GET',
        '/notifications',
        { query: { unreadOnly, limit } },
      ),
      apiRequest<BackendUnreadCountResponse | number>('GET', '/notifications/unread-count').catch(() => null),
    ])

    const rawItems = Array.isArray(rawList) ? rawList : (rawList?.items ?? [])
    const items = rawItems.map(mapBackendNotification)

    let unreadCount: number
    if (typeof rawUnread === 'number') {
      unreadCount = rawUnread
    } else if (rawUnread && typeof rawUnread.unreadCount === 'number') {
      unreadCount = rawUnread.unreadCount
    } else if (!Array.isArray(rawList) && typeof rawList?.unreadCount === 'number') {
      unreadCount = rawList.unreadCount
    } else {
      unreadCount = items.filter((i) => !i.isRead).length
    }

    return { items, unreadCount }
  }

  /** GET /notifications/unread-count */
  async getUnreadCount(): Promise<number> {
    const res = await apiRequest<BackendUnreadCountResponse | number>('GET', '/notifications/unread-count')
    return typeof res === 'number' ? res : Number(res?.unreadCount ?? 0)
  }

  /** PATCH /notifications/{id}/read */
  async markAsRead(id: string): Promise<NotificationDto> {
    const raw = await apiRequest<BackendNotificationResponse | undefined>('PATCH', `/notifications/${id}/read`)
    if (raw && raw.id != null) {
      return mapBackendNotification({ ...raw, isRead: true })
    }
    return {
      id: String(id),
      kind: 'system',
      actorName: null,
      text: '',
      title: '',
      message: '',
      linkUrl: '',
      targetPath: '',
      isRead: true,
      createdAt: new Date().toISOString(),
    }
  }

  /** PATCH /notifications/read-all */
  async markAllAsRead(): Promise<void> {
    await apiRequest<unknown>('PATCH', '/notifications/read-all')
  }
}
