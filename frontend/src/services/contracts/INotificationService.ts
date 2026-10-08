import type { NotificationDto, NotificationListDto } from '../../types/notification.types'

export interface INotificationService {
  /** GET   /notifications?limit=  (newest first, includes unreadCount) */
  list(limit?: number): Promise<NotificationListDto>
  /** PATCH /notifications/{id}/read */
  markAsRead(id: string): Promise<NotificationDto>
  /** POST  /notifications/read-all */
  markAllAsRead(): Promise<void>
}
