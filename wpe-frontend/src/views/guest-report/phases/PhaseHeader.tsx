import type { ReactNode } from 'react'
import type { GuestReportPhase } from '../../../domain/guestReport'
import { VerdictChip, fmtDay, plural } from '../ui'
import { phaseLabel } from './taskHelpers'

export interface PhaseHeaderProps {
  phase: GuestReportPhase
  allPhases: GuestReportPhase[]
  artifactCount: number
  onCommentPhase: (phaseId: string) => void
  rightSlot?: ReactNode
}

export function PhaseHeader({
  phase,
  allPhases,
  artifactCount,
  onCommentPhase,
  rightSlot,
}: PhaseHeaderProps) {
  const upstreamPhases = phase.parentIds
    .map((pid) => allPhases.find((p) => p.id === pid && p.index >= 0))
    .filter((p): p is GuestReportPhase => Boolean(p))
    .sort((a, b) => a.index - b.index)

  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">{phaseLabel(phase)}</h3>
          <VerdictChip label={phase.verdict.label} tone={phase.verdict.tone} />
          <span className="text-xs text-slate-600">
            <b>
              {phase.done}/{phase.tasks.length}
            </b>{' '}
            done
          </span>
          {phase.onTimePct !== null && (
            <span className="text-xs text-slate-600">· {phase.onTimePct}% on time</span>
          )}
          {artifactCount > 0 && (
            <span className="text-xs text-slate-600">· {plural(artifactCount, 'deliverable')}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Planned end <b className="text-slate-700">{fmtDay(phase.plannedEnd)}</b>
          {phase.end && (
            <>
              {' '}
              · finished <b className="text-slate-700">{fmtDay(phase.end)}</b>
            </>
          )}
          {phase.index >= 0 && (
            <>
              {' '}
              · comes after:{' '}
              <b className="text-slate-700">
                {upstreamPhases.length > 0
                  ? upstreamPhases.map((u) => `Phase ${u.index + 1}`).join(', ')
                  : 'nothing (starting phase)'}
              </b>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => onCommentPhase(phase.id)}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          Comment on this phase
        </button>
        {rightSlot}
      </div>
    </div>
  )
}
