export type NotificationKind = 'approval' | 'comment' | 'overdue' | 'assignment' | 'pr' | 'system' | 'invitation'

export interface NotificationDto {
  id: string
  kind: NotificationKind
  /** null = system event (no human sender) */
  actorName: string | null
  /** Event text WITHOUT the actor name, e.g. "approved schema for WPE-009" */
  text: string
  /** ISO-8601 timestamp; the UI renders it as "2 mins ago" */
  createdAt: string
  isRead: boolean
  /** In-app route to open when the notification is clicked */
  targetPath: string
  /** Optional raw fields from backend NotificationResponse */
  title?: string
  message?: string
  linkUrl?: string | null
}

export interface NotificationListDto {
  items: readonly NotificationDto[]
  unreadCount: number
}
