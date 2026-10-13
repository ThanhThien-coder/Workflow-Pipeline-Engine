import { create } from 'zustand'
import { notificationService } from '../services/container'
import type { NotificationDto } from '../types/notification.types'

interface NotificationState {
  items: NotificationDto[]
  unreadCount: number
  loading: boolean
  error: boolean
  load: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
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
    if (before.find((i) => i.id === id)?.isRead !== false) return
    const items = before.map((i) => (i.id === id ? { ...i, isRead: true } : i))
    set({ items, unreadCount: countUnread(items) })
    try {
      await notificationService.markAsRead(id)
    } catch {
      set({ items: before, unreadCount: countUnread(before) })
    }
  },
  markAllRead: async () => {
    const before = get().items
    const items = before.map((i) => ({ ...i, isRead: true }))
    set({ items, unreadCount: 0 })
    try {
      await notificationService.markAllAsRead()
    } catch {
      set({ items: before, unreadCount: countUnread(before) })
    }
  },
}))
