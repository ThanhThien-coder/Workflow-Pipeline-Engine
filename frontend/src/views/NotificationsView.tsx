import { useEffect } from 'react'
import clsx from 'clsx'
import { CheckCheck, ChevronLeft } from 'lucide-react'
import { formatNotificationTime, NotificationSender } from '../components/common/NotificationBell'
import { navigate } from '../router/useRouter'
import { useNotificationStore } from '../store/useNotificationStore'
import type { NotificationDto } from '../types/notification.types'

export default function NotificationsView() {
  const { items, unreadCount, loading, error, load, markRead, markAllRead } = useNotificationStore()

  useEffect(() => {
    void load()
  }, [load])

  const openNotification = (notification: NotificationDto) => {
    void markRead(notification.id)
    navigate(notification.targetPath)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/workspaces')}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
          >
            <ChevronLeft size={17} />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">All Notifications</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {unreadCount === 0 ? 'You are all caught up' : `${unreadCount} unread`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0 || loading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent sm:text-sm"
          >
            <CheckCheck size={16} />
            <span className="hidden sm:inline">Mark all as read</span>
            <span className="sm:hidden">Mark all</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Notifications">
          {loading && items.length === 0 && (
            <div className="space-y-4 p-6" aria-label="Loading notifications">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                    <div className="h-3 w-1/4 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && items.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-600">Could not load notifications.</p>
              <button type="button" onClick={() => void load()} className="mt-2 text-sm font-semibold text-indigo-600 hover:underline">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">You are all caught up.</p>
              <p className="mt-1 text-xs text-slate-500">New notifications will appear here.</p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={clsx(
                      'flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-6',
                      !notification.isRead && 'bg-indigo-50/50 hover:bg-indigo-50',
                    )}
                  >
                    <NotificationSender n={notification} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-relaxed text-slate-600">
                        {notification.actorName && notification.kind !== 'overdue' && (
                          <strong className="font-semibold text-slate-900">{notification.actorName} </strong>
                        )}
                        {notification.text}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                    {!notification.isRead && (
                      <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
