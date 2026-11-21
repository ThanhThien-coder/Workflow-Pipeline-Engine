import { vnDay, type GuestReportModel, type GuestVerdictTone } from '../../../domain/guestReport'
import { Card, VerdictChip, fmtDay, plural } from '../ui'
import { phaseLabel } from './helpers'

const DAY_MS = 86_400_000

const PLAN_BAR_COLOR: Record<GuestVerdictTone, string> = {
  emerald: 'bg-emerald-400',
  orange: 'bg-emerald-400',
  rose: 'bg-blue-400',
  blue: 'bg-blue-400',
  slate: 'bg-slate-300',
}

export interface PhaseScorecardProps {
  model: GuestReportModel
  onOpenPhase: (phaseId: string) => void
}

export function PhaseScorecard({ model, onOpenPhase }: PhaseScorecardProps) {
  const { metrics: m, serverNow } = model
  const phases = model.phases.filter((p) => p.tasks.length > 0)

  if (phases.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">No phases or tasks yet.</p>
      </Card>
    )
  }

  const startCandidates = [model.project.createdAt.getTime(), ...model.tasks.map((t) => t.created.getTime())]
  const t0 = vnDay(new Date(Math.min(...startCandidates))).getTime()

  const endCandidates = [m.lastDueDate, m.completed ? m.finishedAt : serverNow]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime())
  const rawEnd = endCandidates.length > 0 ? Math.max(...endCandidates) : serverNow.getTime()
  const t1 = Math.max(t0 + DAY_MS, rawEnd) + 2 * DAY_MS

  const posX = (ms: number) => Math.max(0, Math.min(100, ((ms - t0) / (t1 - t0)) * 100))
  const todayX = posX(serverNow.getTime())
  const cols = 'sm:grid-cols-[minmax(0,1.25fr)_96px_minmax(0,2fr)_150px]'

  return (
    <Card>
      <div
        className={`hidden gap-4 border-b border-slate-100 pb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 sm:grid ${cols}`}
      >
        <span>Phase</span>
        <span>Done</span>
        <span className="flex justify-between">
          <span>{fmtDay(new Date(t0))}</span>
          <span>Timeline</span>
          <span>{fmtDay(new Date(t1 - 2 * DAY_MS))}</span>
        </span>
        <span>Result</span>
      </div>

      <div className="divide-y divide-slate-100">
        {phases.map((ph) => {
          const s = ph.start ? posX(ph.start.getTime()) : null
          const e = posX((ph.end ?? serverNow).getTime())
          const p = ph.plannedEnd ? posX(ph.plannedEnd.getTime()) : null
          const overrun = s !== null && p !== null && e > p
          const withinEnd = p !== null ? Math.min(e, p) : e
          const lateTotal = ph.late + ph.overdue

          return (
            <button
              key={ph.id}
              type="button"
              onClick={() => onOpenPhase(ph.id)}
              className={`group grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 py-3 text-left hover:bg-slate-50 sm:py-2.5 ${cols}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                  {phaseLabel(ph)}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {plural(ph.tasks.length, 'task')}
                  {ph.onTimePct !== null && <> · {ph.onTimePct}% on time</>}
                  {lateTotal > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-orange-600">{lateTotal} late</span>
                    </>
                  )}
                </span>
              </span>

              <span className="flex items-center gap-2">
                <span className="w-9 text-right text-xs font-bold text-slate-800">{ph.pct}%</span>
                <span className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full ${ph.end ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${ph.pct}%` }}
                  />
                </span>
              </span>

              <span
                className="relative block h-6"
                title={`${
                  ph.start ? `Worked ${fmtDay(ph.start)} → ${ph.end ? fmtDay(ph.end) : 'now'}` : 'Not started'
                } · planned end ${fmtDay(ph.plannedEnd)}`}
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                {s !== null && (
                  <span
                    className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${PLAN_BAR_COLOR[ph.verdict.tone]}`}
                    style={{ left: `${s}%`, width: `${Math.max(1.2, withinEnd - s)}%` }}
                  />
                )}
                {overrun && s !== null && p !== null && (
                  <span
                    className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-r-full ${
                      ph.end ? 'bg-orange-500' : 'bg-rose-500'
                    }`}
                    style={{ left: `${Math.max(s, p)}%`, width: `${Math.max(1, e - Math.max(s, p))}%` }}
                  />
                )}
                {p !== null && (
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white bg-slate-800"
                    style={{ left: `${p}%` }}
                  />
                )}
                {!m.completed && (
                  <span className="absolute inset-y-0 w-px bg-indigo-400" style={{ left: `${todayX}%` }} />
                )}
              </span>

              <span className="flex flex-col items-start gap-0.5">
                <VerdictChip label={ph.verdict.label} tone={ph.verdict.tone} />
                <span className="text-[10.5px] text-slate-500">
                  {ph.end ? `done ${fmtDay(ph.end)} · ` : ''}plan {fmtDay(ph.plannedEnd)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-emerald-400" />
          worked on, within plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-orange-500" />
          past the planned end (finished)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-rose-500" />
          past the planned end (still open)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-slate-800" />
          planned end
        </span>
        {!m.completed && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-indigo-400" />
            today
          </span>
        )}
        <span className="ml-auto print:hidden">Click a phase to open its tasks</span>
      </div>
    </Card>
  )
}
