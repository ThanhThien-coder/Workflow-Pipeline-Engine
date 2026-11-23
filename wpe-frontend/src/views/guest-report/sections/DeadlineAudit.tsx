import { useState } from 'react'
import { daysBetween, type GuestReportModel, type GuestTask } from '../../../domain/guestReport'
import { Card, fmtDay } from '../ui'

type AuditKind = 0 | 1 | 2 | 3

interface AuditRowItem {
  task: GuestTask
  kind: AuditKind
  badge: string
  line: string
}

const AUDIT_TONE: Record<AuditKind, [string, string, string]> = {
  0: ['bg-rose-600', 'border-rose-200 bg-rose-50/50', 'bg-rose-100 text-rose-700'],
  1: ['bg-amber-500', 'border-amber-200 bg-amber-50/50', 'bg-amber-100 text-amber-800'],
  2: ['bg-amber-500', 'border-amber-200 bg-amber-50/50', 'bg-amber-100 text-amber-800'],
  3: ['bg-orange-600', 'border-orange-200 bg-orange-50/40', 'bg-orange-100 text-orange-800'],
}

const LIMIT = 4

export interface DeadlineAuditProps {
  model: GuestReportModel
  onGraph: (taskId: string) => void
  /** Không truyền thì ẩn nút Comment (Overview của thành viên không có góp ý kiểu khách). */
  onComment?: (taskId: string) => void
}

export function DeadlineAudit({ model, onGraph, onComment }: DeadlineAuditProps) {
  const { metrics: m, serverNow, byId, membersById } = model
  const tabs: Array<['now' | 'late', string, number]> = [
    ...(m.completed ? [] : ([['now', 'Needs attention', m.attention.length]] as Array<['now', string, number]>)),
    ['late', 'Finished late', m.lateDone.length],
  ]

  const [tab, setTab] = useState<'now' | 'late'>(m.completed ? 'late' : 'now')
  const [all, setAll] = useState(false)
  const effectiveTab: 'now' | 'late' = m.completed ? 'late' : tab

  const nowItems: AuditRowItem[] = m.attention.map(({ task, kind, text }) => {
    const left = task.due ? daysBetween(serverNow, task.due) : 0
    const badge =
      kind === 0
        ? `+${Math.max(0, -left)}d now`
        : kind === 1
          ? left === 0
            ? 'due today'
            : `due in ${left}d`
          : 'no owner'
    const line = kind === 2 ? `Due ${fmtDay(task.due)}` : text
    return { task, kind, badge, line }
  })

  const lateItems: AuditRowItem[] = m.lateDone.map(({ task, lateBy }) => ({
    task,
    kind: 3,
    badge: `+${lateBy}d late`,
    line: `Due ${fmtDay(task.due)} → done ${fmtDay(task.done)}`,
  }))

  const slipsCount = m.missed
  const avg = slipsCount > 0 ? ((m.lateDays + m.overdueDays) / slipsCount).toFixed(1) : '0'
  const worstOverdue = m.overdue.reduce(
    (max, t) => Math.max(max, t.due ? daysBetween(t.due, serverNow) : 0),
    0,
  )
  const worstLate = m.lateDone.reduce((max, item) => Math.max(max, item.lateBy), 0)
  const worst = Math.max(worstOverdue, worstLate)

  const renderItem = (it: AuditRowItem) => {
    const [chip, box, badgeCls] = AUDIT_TONE[it.kind]
    const blockCodes = it.task.blocks.map((id) => byId[id]?.code ?? id)
    const assignee = it.task.assigneeId ? membersById[it.task.assigneeId] : null

    return (
      <div className={`rounded-xl border p-2.5 ${box}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white ${chip}`}>
              {it.task.code}
            </span>
            <span className="truncate text-xs font-semibold text-slate-900" title={it.task.title}>
              {it.task.title}
            </span>
          </div>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badgeCls}`}>{it.badge}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-600">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span>{it.line}</span>
            {it.kind !== 3 && blockCodes.length > 0 && (
              <span className="font-semibold text-rose-700">
                blocks → <span className="font-mono">{blockCodes.slice(0, 2).join(', ')}</span>
                {blockCodes.length > 2 && ` +${blockCodes.length - 2}`}
              </span>
            )}
            {assignee && <span className="text-slate-400">{assignee.name}</span>}
            {it.task.reopened && (
              <span className="rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">Reopened</span>
            )}
          </span>
          <span className="flex shrink-0 gap-2 font-semibold print:hidden">
            <button
              type="button"
              onClick={() => onGraph(it.task.id)}
              className="text-indigo-700 hover:underline"
            >
              Graph
            </button>
            {onComment && (
              <button
                type="button"
                onClick={() => onComment(it.task.id)}
                className="text-slate-700 hover:underline"
              >
                Comment
              </button>
            )}
          </span>
        </div>
      </div>
    )
  }

  const renderList = (
    listKey: 'now' | 'late',
    heading: string,
    items: AuditRowItem[],
    active: boolean,
    emptyText: string,
  ) => (
    <div data-testid={`deadline-list-${listKey}`} className={active ? '' : 'hidden print:block'}>
      {!active && (
        <p className="mb-1.5 mt-3 hidden text-[11px] font-bold uppercase tracking-wide text-slate-500 print:block">
          {heading}
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-700">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div
              key={it.task.id}
              data-testid={`deadline-row-${listKey}`}
              className={all || i < LIMIT ? '' : 'hidden print:block'}
            >
              {renderItem(it)}
            </div>
          ))}
        </div>
      )}
      {active && items.length > LIMIT && (
        <button
          type="button"
          onClick={() => setAll((prev) => !prev)}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 print:hidden"
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  )

  return (
    <Card className="h-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Deadlines</h3>
        <div className="flex gap-1 text-[11px] print:hidden">
          {tabs.map(([k, label, count]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k)
                setAll(false)
              }}
              className={`rounded-md px-2 py-0.5 font-semibold ${
                effectiveTab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div>
          <span className="block text-[10px] font-semibold uppercase text-slate-400">
            Avg slip · {slipsCount} tasks
          </span>
          <b className="text-slate-900">+{avg}d</b>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Worst slip</span>
          <b className={worst > 0 ? 'text-rose-600' : 'text-slate-900'}>+{worst}d</b>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase text-slate-400">Reopened</span>
          <b className="text-slate-900">{m.reopened}</b>
        </div>
      </div>

      {!m.completed &&
        renderList('now', 'Needs attention', nowItems, effectiveTab === 'now', 'Nothing needs action right now.')}
      {renderList(
        'late',
        'Finished late',
        lateItems,
        effectiveTab === 'late',
        'Clean record: no task was delivered after its due date.',
      )}
    </Card>
  )
}
