import { Check, CheckCircle2 } from 'lucide-react'
import type { FeedbackItem } from '../../types/overview.types'
import { relativeEn } from '../../utils/relativeTime'

export interface FeedbackQueueCardProps {
  items: FeedbackItem[]
  onResolve: (item: FeedbackItem) => void
}

export function FeedbackQueueCard({ items, onResolve }: FeedbackQueueCardProps) {
  const openCount = items.filter((item) => item.status === 'OPEN').length

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Feedback Queue</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            openCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {openCount} OPEN
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">Không có phản hồi nào trong hàng đợi.</p>
        ) : (
          items.map((item) => {
            const isResolved = item.status === 'RESOLVED'
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3.5 transition ${
                  isResolved
                    ? 'border-slate-100 bg-slate-50/60 opacity-60'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{item.reviewerName}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                      {item.reviewerRole}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isResolved
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isResolved && <Check size={10} />}
                    {item.status}
                  </span>
                </div>

                <div className="mt-1 text-xs font-medium text-indigo-600">
                  {item.nodeRef.code} · {item.nodeRef.title}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.content}</p>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2">
                  <span className="text-[11px] text-slate-400">{relativeEn(item.createdAt)}</span>
                  {!isResolved ? (
                    <button
                      type="button"
                      onClick={() => onResolve(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Check size={12} />
                      <span>Mark Resolved</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 size={12} />
                      <span>Đã xử lý</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
