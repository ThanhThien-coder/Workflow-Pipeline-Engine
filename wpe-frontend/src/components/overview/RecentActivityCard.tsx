import type { ActivityItem } from '../../types/overview.types'
import { relativeEn } from '../../utils/relativeTime'
import { getSavedAvatar } from '../../utils/avatarUtils'

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Recent Activity</h3>
      <ul className="space-y-4">
        {items.map((item) => {
          const avatarUrl = item.actor.avatarUrl || getSavedAvatar(item.actor.name)

          return (
            <li key={item.id} className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={item.actor.name}
                  title={item.actor.name}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <span
                  title={item.actor.name}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${item.actor.avatarClass}`}
                >
                  {item.actor.initials}
                </span>
              )}
              <div className="flex-1 text-sm">
                <b>{item.actor.initials}</b> <span className="text-slate-600">{item.message}</span>
              </div>
              <span className="whitespace-nowrap text-xs text-slate-400">{relativeEn(item.occurredAt)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
