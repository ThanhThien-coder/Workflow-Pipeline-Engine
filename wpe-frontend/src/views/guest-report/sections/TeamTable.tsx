import { useState } from 'react'
import type { GuestReportModel, GuestTeamMemberRow } from '../../../domain/guestReport'
import { Avatar, Card, Sub, plural, type AvatarPerson } from '../ui'
import { formatMemberRole } from './helpers'

const LIMIT = 6

function pctBadgeClass(pct: number | null): string {
  if (pct === null) return 'text-slate-400'
  if (pct >= 80) return 'bg-emerald-50 text-emerald-700'
  if (pct >= 60) return 'bg-amber-50 text-amber-800'
  return 'bg-rose-50 text-rose-700'
}

/** Một dòng của bảng: một thành viên, hoặc dòng "Unassigned" (G39) gom các task chưa giao cho ai. */
function TeamRow({
  r,
  person,
  className = '',
  isUnassigned = false,
}: {
  r: GuestTeamMemberRow
  person: AvatarPerson | null
  className?: string
  isUnassigned?: boolean
}) {
  const roleMeta = [
    isUnassigned ? 'No assignee' : formatMemberRole(r.member.role),
    r.todo > 0 ? `${r.todo} to do` : '',
    r.waiting > 0 ? `${r.waiting} waiting` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <tr className={className}>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <Avatar person={person} size="h-7 w-7 text-[10px]" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{r.member.name}</div>
            <div className="text-[10.5px] text-slate-400">{roleMeta}</div>
          </div>
        </div>
      </td>

      <td className="py-2 text-center font-semibold text-emerald-700">{r.onTime}</td>

      <td
        className={`py-2 text-center font-semibold ${r.late > 0 ? 'text-orange-700' : 'text-slate-300'}`}
        title={
          r.worst ? `Most late: ${r.worst.task.code}, done ${r.worst.lateBy} days after its due date` : undefined
        }
      >
        {r.late}
        {r.worst && (
          <span className="block whitespace-nowrap text-[10px] font-normal text-orange-500">
            worst +{r.worst.lateBy}d
          </span>
        )}
      </td>

      <td className={`py-2 text-center font-semibold ${r.overdue > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
        {r.overdue}
      </td>

      <td className="py-2 text-center text-slate-600">{r.active}</td>

      <td className="w-28 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${r.total > 0 ? (r.onTime / r.total) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-emerald-300"
              style={{
                width: `${r.total > 0 ? (Math.max(0, r.done - r.onTime - r.late) / r.total) * 100 : 0}%`,
              }}
            />
            <div className="h-full bg-orange-400" style={{ width: `${r.total > 0 ? (r.late / r.total) * 100 : 0}%` }} />
          </div>
          <span className="w-9 text-right text-[11px] font-semibold text-slate-700">
            {r.done}/{r.total}
          </span>
        </div>
      </td>

      <td className="py-2 text-right">
        {r.onTimePct === null ? (
          <span className="text-slate-400">{r.total > 0 ? '—' : 'no task'}</span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${pctBadgeClass(r.onTimePct)}`}>
            {r.onTimePct}%
          </span>
        )}
      </td>
    </tr>
  )
}

export interface TeamTableProps {
  model: GuestReportModel
  avatarById: Record<string, AvatarPerson>
}

export function TeamTable({ model, avatarById }: TeamTableProps) {
  const { rows, unassignedRow } = model.team
  const [all, setAll] = useState(false)

  return (
    <Card
      className="h-full"
      title="Who did what"
      note={
        <Sub>
          Per member, from the tasks currently assigned to them. Sorted by tasks done, then on-time %. Tasks with no
          assignee are grouped in the last row.
        </Sub>
      }
      right={
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {plural(rows.length, 'member')}
        </span>
      }
    >
      <div className="-mx-1 overflow-x-auto px-1 print:overflow-visible">
        <table className="w-full min-w-[540px] text-left text-xs print:min-w-0">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] text-slate-500">
              <th className="pb-2 font-semibold">Member</th>
              <th className="pb-2 text-center font-semibold">On time</th>
              <th className="pb-2 text-center font-semibold" title="Tasks finished after their due date">
                Done late
              </th>
              <th className="pb-2 text-center font-semibold">Overdue</th>
              <th className="pb-2 text-center font-semibold">Active</th>
              <th className="pb-2 font-semibold">Done</th>
              <th className="pb-2 text-right font-semibold">On-time %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <TeamRow
                key={r.memberId}
                r={r}
                person={avatarById[r.memberId] ?? null}
                className={all || i < LIMIT ? '' : 'hidden print:table-row'}
              />
            ))}

            {/* G39: task không ai làm cũng có một dòng như thành viên, kể cả khi đã xong. Luôn ở cuối, không bị ẩn. */}
            {unassignedRow && <TeamRow r={unassignedRow} person={null} className="bg-slate-50/70" isUnassigned />}
          </tbody>
        </table>
      </div>

      {rows.length > LIMIT && (
        <button
          type="button"
          onClick={() => setAll((prev) => !prev)}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 print:hidden"
        >
          {all ? `Show top ${LIMIT}` : `Show all ${rows.length} members`}
        </button>
      )}
    </Card>
  )
}
