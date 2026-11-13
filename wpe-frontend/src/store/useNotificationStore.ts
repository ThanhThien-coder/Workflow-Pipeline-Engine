import { create } from 'zustand'
import { notificationService } from '../services/container'
import { mapBackendNotification, type BackendNotificationResponse } from '../services/impl/HttpNotificationService'
import type { NotificationDto } from '../types/notification.types'

interface NotificationState {
  items: NotificationDto[]
  unreadCount: number
  loading: boolean
  error: boolean
  load: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  receiveRealtime: (payload: BackendNotificationResponse | NotificationDto) => void
}

const countUnread = (items: NotificationDto[]) => items.filter((i) => !i.isRead).length

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: false,
  load: async () => {
    set({ loading: get().items.length === 0, error: false })
    try {
      const res = await notificationService.list(30)
      set({ items: [...res.items], unreadCount: res.unreadCount, loading: false })
    } catch {
      set({ loading: false, error: true })
    }
  },
  // Optimistic: the row and the bell badge update instantly, roll back if the call fails
  markRead: async (id) => {
    const before = get().items
    const beforeUnread = get().unreadCount
    const target = before.find((i) => String(i.id) === String(id))
    if (target?.isRead === true) return

    const items = before.map((i) => (String(i.id) === String(id) ? { ...i, isRead: true } : i))
    const nextUnread = target ? Math.max(0, countUnread(items)) : Math.max(0, beforeUnread - 1)
    set({ items, unreadCount: nextUnread })
    try {
      await notificationService.markAsRead(String(id))
    } catch {
      set({ items: before, unreadCount: beforeUnread })
    }
  },
  markAllRead: async () => {
    const before = get().items
    const beforeUnread = get().unreadCount
    const items = before.map((i) => ({ ...i, isRead: true }))
    set({ items, unreadCount: 0 })
    try {
      await notificationService.markAllAsRead()
    } catch {
      set({ items: before, unreadCount: beforeUnread })
    }
  },
  receiveRealtime: (payload) => {
    if (!payload || payload.id == null) return
    const current = get().items
    if (current.some((i) => String(i.id) === String(payload.id))) return

    const mapped: NotificationDto =
      'kind' in payload && typeof payload.kind === 'string' && 'text' in payload
        ? (payload as NotificationDto)
        : mapBackendNotification(payload as BackendNotificationResponse)

    const items = [mapped, ...current]
    const unreadCount = mapped.isRead ? get().unreadCount : get().unreadCount + 1
    set({ items, unreadCount })
  },
}))
