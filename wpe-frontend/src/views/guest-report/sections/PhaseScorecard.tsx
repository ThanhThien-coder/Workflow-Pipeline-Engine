import type { GuestReportModel } from '../../../domain/guestReport'
import { Card, VerdictChip, fmtDay, plural } from '../ui'
import { phaseLabel } from './helpers'

export interface PhaseScorecardProps {
  model: GuestReportModel
  onOpenPhase: (phaseId: string) => void
}

export function PhaseScorecard({ model, onOpenPhase }: PhaseScorecardProps) {
  const phases = model.phases.filter((p) => p.tasks.length > 0)

  if (phases.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">No phases or tasks yet.</p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="-mx-1 overflow-x-auto px-1 print:overflow-visible">
        <table className="w-full min-w-[560px] text-left text-xs print:min-w-0">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-semibold">Phase</th>
              <th className="pb-2 px-2 text-center font-semibold">Done</th>
              <th
                className="pb-2 px-2 text-center font-semibold"
                title="Overdue now + finished late"
              >
                Late
              </th>
              <th className="pb-2 px-3 font-semibold">Dates</th>
              <th className="pb-2 pl-2 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {phases.map((ph) => {
              const lateTotal = ph.late + ph.overdue
              const workedText = ph.start
                ? `Worked ${fmtDay(ph.start)} → ${ph.end ? fmtDay(ph.end) : 'now'}`
                : 'Not started'
              const plannedText = ph.plannedEnd
                ? `Planned end ${fmtDay(ph.plannedEnd)}`
                : 'No due dates'

              return (
                <tr
                  key={ph.id}
                  onClick={() => onOpenPhase(ph.id)}
                  className="group cursor-pointer hover:bg-slate-50"
                >
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenPhase(ph.id)
                      }}
                      className="block w-full min-w-0 text-left"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                        {phaseLabel(ph)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {plural(ph.tasks.length, 'task')}
                      </span>
                    </button>
                  </td>

                  <td className="whitespace-nowrap px-2 py-2.5 text-center font-semibold text-slate-800">
                    {ph.done}/{ph.tasks.length}
                  </td>

                  <td
                    className={`whitespace-nowrap px-2 py-2.5 text-center ${
                      lateTotal > 0 ? 'font-bold text-rose-600' : 'text-slate-400'
                    }`}
                    title="Overdue now + finished late"
                  >
                    {lateTotal}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="block text-xs font-medium text-slate-800">{workedText}</span>
                    <span className="block text-[11px] text-slate-500">{plannedText}</span>
                  </td>

                  <td className="py-2.5 pl-2">
                    <VerdictChip label={ph.verdict.label} tone={ph.verdict.tone} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>
          Planned end = due date of the latest task in the phase. Late tasks are counted separately and listed in
          Deadlines.
        </span>
        <span className="print:hidden">Click a phase to open its tasks</span>
      </div>
    </Card>
  )
}
