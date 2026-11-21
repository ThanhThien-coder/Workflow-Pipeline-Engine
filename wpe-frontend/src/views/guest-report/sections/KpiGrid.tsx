import type { ReactNode } from 'react'
import { AlertTriangle, Check, ChevronRight, Clock, Package } from 'lucide-react'
import type { GuestReportModel } from '../../../domain/guestReport'
import { plural } from '../ui'
import { ARTIFACT_KINDS, ARTIFACT_LABELS, onTimeEmptyText } from './helpers'

function Ring({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e0e7ff" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped / 100)}
      />
    </svg>
  )
}

function KpiCard({
  icon,
  tone,
  label,
  children,
  onClick,
  hint,
}: {
  icon: ReactNode
  tone: string
  label: string
  children: ReactNode
  onClick?: () => void
  hint?: string
}) {
  const content = (
    <>
      <div className="flex w-full items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {hint && (
          <span className="ml-auto text-rose-500 print:hidden" title={hint}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 w-full">{children}</div>
    </>
  )

  const baseCls =
    'flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left print:break-inside-avoid print:shadow-none'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseCls} transition hover:border-rose-300 hover:shadow-sm`}
      >
        {content}
      </button>
    )
  }

  return <div className={baseCls}>{content}</div>
}

export interface KpiGridProps {
  model: GuestReportModel
  onOverdue: () => void
}

export function KpiGrid({ model, onOverdue }: KpiGridProps) {
  const m = model.metrics
  const arts = model.artifacts
  const otPct = m.onTimeBase > 0 ? Math.round((m.onTime / m.onTimeBase) * 100) : null
  const types = ARTIFACT_KINDS.map((kind) => ({
    kind,
    count: arts.filter((a) => a.kind === kind).length,
  })).filter((item) => item.count > 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard icon={<Check className="h-4 w-4" />} tone="bg-indigo-50 text-indigo-600" label="Completion">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-3xl font-bold text-slate-900">
              {m.done}
              <span className="text-lg font-semibold text-slate-400">/{m.total}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{m.pct}% of tasks done</div>
          </div>
          <Ring pct={m.pct} />
        </div>
      </KpiCard>

      <KpiCard icon={<Clock className="h-4 w-4" />} tone="bg-emerald-50 text-emerald-600" label="On time">
        <div className="text-3xl font-bold text-slate-900">{otPct === null ? '—' : `${otPct}%`}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {otPct === null
            ? onTimeEmptyText(model.tasks)
            : `${m.onTime} of ${m.onTimeBase} tasks that reached their due date were done in time`}
        </div>
        {otPct !== null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${otPct}%` }} />
          </div>
        )}
      </KpiCard>

      <KpiCard
        icon={<AlertTriangle className="h-4 w-4" />}
        tone="bg-rose-50 text-rose-600"
        label="Missed deadlines"
        onClick={m.missed > 0 ? onOverdue : undefined}
        hint={m.missed > 0 ? 'See list' : undefined}
      >
        <div className={`text-3xl font-bold ${m.missed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{m.missed}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {m.missed > 0 ? (
            <>
              {!m.completed && (
                <>
                  <b className={m.overdue.length > 0 ? 'text-rose-600' : 'text-slate-600'}>
                    {m.overdue.length} overdue now
                  </b>
                  {' · '}
                </>
              )}
              <b className="text-orange-600">{m.lateDone.length} finished late</b>
            </>
          ) : (
            'Every due date met so far'
          )}
        </div>
        {m.overdue.length > 0 && m.blockedByOverdue > 0 && (
          <div className="mt-1 text-[11px] text-slate-500">
            overdue tasks block <b className="text-rose-600">{plural(m.blockedByOverdue, 'later task')}</b>
          </div>
        )}
      </KpiCard>

      <KpiCard icon={<Package className="h-4 w-4" />} tone="bg-violet-50 text-violet-600" label="Deliverables">
        <div className="text-3xl font-bold text-slate-900">{arts.length}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {arts.length > 0 ? 'shared with reviewers' : 'Nothing shared yet'}
        </div>
        {types.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {types.map((item) => (
              <span
                key={item.kind}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600"
              >
                {item.count} {ARTIFACT_LABELS[item.kind]}
              </span>
            ))}
          </div>
        )}
      </KpiCard>
    </div>
  )
}
