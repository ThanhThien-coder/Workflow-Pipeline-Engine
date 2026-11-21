import type { GuestReportBreakdown, GuestReportMetrics } from '../../../domain/guestReport'

const SEGMENTS: readonly { key: keyof GuestReportBreakdown; label: string; color: string }[] = [
  { key: 'DONE', label: 'Done on time', color: 'bg-emerald-500' },
  { key: 'LATE', label: 'Done late', color: 'bg-orange-400' },
  { key: 'REVIEW', label: 'In review', color: 'bg-amber-400' },
  { key: 'IN_PROGRESS', label: 'In progress', color: 'bg-blue-500' },
  { key: 'TODO', label: 'To do', color: 'bg-sky-300' },
  { key: 'LOCKED', label: 'Waiting', color: 'bg-slate-300' },
]

export function StatusRibbon({ metrics }: { metrics: GuestReportMetrics }) {
  const items = SEGMENTS.map((seg) => ({
    ...seg,
    count: metrics.breakdown[seg.key],
  }))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 print:break-inside-avoid print:shadow-none">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {metrics.total > 0 &&
          items.map((item) =>
            item.count > 0 ? (
              <div
                key={item.key}
                className={item.color}
                style={{ width: `${(item.count / metrics.total) * 100}%` }}
                title={`${item.label}: ${item.count}`}
              />
            ) : null,
          )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {items
          .filter((item) => item.count > 0)
          .map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              {item.label}{' '}
              <b className={item.key === 'LATE' ? 'text-orange-700' : 'text-slate-900'}>{item.count}</b>
            </span>
          ))}
        {metrics.total === 0 && <span className="text-slate-400">No tasks yet.</span>}
      </div>
    </div>
  )
}
