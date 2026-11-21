import { daysBetween, type GuestReportMetrics, type GuestReportModel } from '../../../domain/guestReport'
import { fmtDay, plural } from '../ui'
import { hasNoDueDates } from './helpers'

/**
 * Nhãn sức khỏe dự án ở đầu trang.
 * G38: chưa task nào có hạn chót thì không gọi là "On track" / "all on time" (không có mốc để so),
 * dùng cùng luật với kết quả phase ("In progress" xanh dương, "Completed").
 */
export function HealthPill({ metrics, noDueDates = false }: { metrics: GuestReportMetrics; noDueDates?: boolean }) {
  let cls: string
  let dot: string
  let text: string

  if (metrics.completed) {
    if (metrics.lateDone.length > 0) {
      cls = 'border-orange-200 bg-orange-50 text-orange-800'
      dot = 'bg-orange-500'
      text = `Delivered · ${metrics.lateDone.length} finished late`
    } else {
      cls = 'border-emerald-200 bg-emerald-50 text-emerald-700'
      dot = 'bg-emerald-500'
      text = noDueDates ? 'Delivered' : 'Delivered · all on time'
    }
  } else if (metrics.overdue.length > 0) {
    cls = 'border-rose-200 bg-rose-50 text-rose-700'
    dot = 'bg-rose-500'
    text = `At risk · ${metrics.overdue.length} overdue`
  } else if (noDueDates) {
    cls = 'border-blue-200 bg-blue-50 text-blue-700'
    dot = 'bg-blue-500'
    text = 'In progress'
  } else {
    cls = 'border-emerald-200 bg-emerald-50 text-emerald-700'
    dot = 'bg-emerald-500'
    text = 'On track'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

function formatLastActivity(lastUpdated: string | undefined, serverNow: Date): string | null {
  if (!lastUpdated) return null
  const parsed = new Date(lastUpdated)
  if (Number.isNaN(parsed.getTime())) return lastUpdated
  const mins = Math.round((serverNow.getTime() - parsed.getTime()) / 60_000)
  if (mins < 0) return null
  if (mins < 1) return 'just now'
  if (mins < 60) return `${plural(mins, 'minute')} ago`
  if (mins < 48 * 60) return `${plural(Math.round(mins / 60), 'hour')} ago`
  return `${plural(Math.round(mins / 1440), 'day')} ago`
}

// Nhãn trạng thái dự án theo project.status của backend (mock v6 viết cứng "Active").
const STATUS_PILL: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: 'Not started', cls: 'bg-slate-100 text-slate-600' },
  PLANNING: { text: 'Not started', cls: 'bg-slate-100 text-slate-600' },
  PAUSED: { text: 'Paused', cls: 'bg-amber-100 text-amber-800' },
  INACTIVE: { text: 'Inactive', cls: 'bg-slate-100 text-slate-600' },
  ARCHIVED: { text: 'Archived', cls: 'bg-slate-100 text-slate-600' },
  COMPLETED: { text: 'Completed', cls: 'bg-slate-800 text-white' },
}

export interface ProjectHeaderProps {
  model: GuestReportModel
  lastUpdated?: string
}

export function ProjectHeader({ model, lastUpdated }: ProjectHeaderProps) {
  const { project, metrics: m, serverNow, members, realPhaseCount } = model
  const activeMemberCount = members.filter((mem) => String(mem.role).toUpperCase() !== 'FORMER').length
  const activityText = formatLastActivity(lastUpdated, serverNow)
  const notStarted = project.status === 'DRAFT' || project.status === 'PLANNING'
  const statusPill = STATUS_PILL[project.status] ?? { text: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
  const snapshotTime = serverNow.toLocaleString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div>
      <div className="mb-3 hidden border-b border-slate-300 pb-2 text-xs text-slate-500 print:block">
        Progress snapshot · {snapshotTime} (Vietnam time) · Pipeline Engine guest view
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{project.name}</h1>
        {m.completed ? (
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-white">Completed</span>
        ) : (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill.cls}`}>{statusPill.text}</span>
        )}
        {realPhaseCount > 0 && (
          <span className="max-w-full truncate rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            {m.completed
              ? `All ${realPhaseCount} phases completed`
              : m.currentPhase
                ? `Phase ${m.currentPhase.index + 1} of ${realPhaseCount} · ${m.currentPhase.name}`
                : `${plural(realPhaseCount, 'phase')}`}
          </span>
        )}
        {!notStarted && <HealthPill metrics={m} noDueDates={hasNoDueDates(model.tasks)} />}
      </div>

      {project.description && (
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{project.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {notStarted ? 'Created' : 'Started'} <b className="text-slate-700">{fmtDay(project.createdAt)}</b>
        </span>

        {m.completed ? (
          m.finishedAt && (
            <span>
              Finished <b className="text-slate-700">{fmtDay(m.finishedAt)}</b>
              {m.lastDueDate && (() => {
                const diff = daysBetween(m.lastDueDate, m.finishedAt)
                if (diff > 0) {
                  return (
                    <>
                      {' '}
                      <b className="text-orange-600">
                        ({plural(diff, 'day')} after the planned end, {fmtDay(m.lastDueDate)})
                      </b>
                    </>
                  )
                }
                return (
                  <>
                    {' '}
                    <span className="text-emerald-700">
                      ({diff === 0 ? 'on' : `${plural(-diff, 'day')} before`} the planned end)
                    </span>
                  </>
                )
              })()}
            </span>
          )
        ) : (
          m.lastDueDate && (() => {
            const left = daysBetween(serverNow, m.lastDueDate)
            return left >= 0 ? (
              <span>
                Target deadline <b className="text-slate-700">{fmtDay(m.lastDueDate)}</b> ({plural(left, 'day')} left)
              </span>
            ) : (
              <span>
                Target deadline <b className="text-slate-700">{fmtDay(m.lastDueDate)}</b>{' '}
                <b className="text-rose-600">({plural(-left, 'day')} past)</b>
              </span>
            )
          })()
        )}

        <span>
          <b className="text-slate-700">{activeMemberCount}</b> {activeMemberCount === 1 ? 'member' : 'members'}
        </span>

        {activityText && (
          <span>
            Last activity <b className="text-slate-700">{activityText}</b>
          </span>
        )}
      </div>
    </div>
  )
}
