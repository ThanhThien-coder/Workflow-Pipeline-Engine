import type { ActivityItem } from '../../types/overview.types'
import { relativeEn } from '../../utils/relativeTime'
import { getSavedAvatar } from '../../utils/avatarUtils'
import { AvatarImage } from '../common/Avatar'
import { navigate } from '../../router/useRouter'

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Recent Activity</h3>
      {items.length === 0 ? (
        <p data-testid="recent-activity-empty" className="py-4 text-center text-xs text-slate-400">
          No recent activity yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const avatarUrl = item.actor.avatarUrl || getSavedAvatar(item.actor.name)
            const actorId = item.actor.id ? String(item.actor.id) : null
            const openProfile = () => navigate('/people/' + actorId)

            const avatar = (
              <AvatarImage
                src={avatarUrl}
                alt={item.actor.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                fallback={
                  <span
                    title={item.actor.name}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${item.actor.avatarClass}`}
                  >
                    {item.actor.initials}
                  </span>
                }
              />
            )

            return (
              <li key={item.id} className="flex items-center gap-3">
                {actorId ? (
                  <button
                    type="button"
                    title="View profile"
                    aria-label={`View profile of ${item.actor.name}`}
                    onClick={openProfile}
                    className="shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    {avatar}
                  </button>
                ) : (
                  avatar
                )}
                <div className="flex-1 text-sm">
                  {actorId ? (
                    <button
                      type="button"
                      title="View profile"
                      onClick={openProfile}
                      className="cursor-pointer font-bold outline-none hover:text-indigo-600 focus-visible:underline"
                    >
                      {item.actor.name}
                    </button>
                  ) : (
                    <b>{item.actor.name}</b>
                  )}{' '}
                  <span className="text-slate-600">{item.message}</span>
                </div>
                <span className="whitespace-nowrap text-xs text-slate-400">{relativeEn(item.occurredAt)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
