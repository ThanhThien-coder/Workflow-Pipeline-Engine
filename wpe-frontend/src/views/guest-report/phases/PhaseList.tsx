import type { GuestArtifact, GuestReportPhase } from '../../../domain/guestReport'
import { VerdictChip } from '../ui'
import { PHASE_ICON_PATHS, PhaseIcon } from './icons'
import { countPhaseArtifacts } from './taskHelpers'

export interface PhaseListProps {
  phases: GuestReportPhase[]
  selectedPhaseId: string | null
  artifactsByTask: Record<string, GuestArtifact[]>
  onSelectPhase: (phaseId: string) => void
}

export function PhaseList({
  phases,
  selectedPhaseId,
  artifactsByTask,
  onSelectPhase,
}: PhaseListProps) {
  const realPhases = phases.filter((p) => p.index >= 0)
  const unphased = phases.find((p) => p.index === -1) ?? null

  if (realPhases.length === 0 && !unphased) {
    return null
  }

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">
        {realPhases.map((phase) => {
          const isSelected = phase.id === selectedPhaseId
          const artCount = countPhaseArtifacts(phase, artifactsByTask)
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onSelectPhase(phase.id)}
              aria-pressed={isSelected}
              className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition sm:grid sm:grid-cols-[minmax(0,1fr)_auto_128px_auto] ${
                isSelected
                  ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-300'
                  : 'hover:bg-slate-50'
              }`}
            >
              <span className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  Phase {phase.index + 1}
                </span>
                <span className="truncate text-sm font-semibold text-slate-900" title={phase.name}>
                  {phase.name}
                </span>
              </span>

              <VerdictChip label={phase.verdict.label} tone={phase.verdict.tone} />

              <span className="flex w-28 items-center gap-2 sm:w-full">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full ${phase.end ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${phase.pct}%` }}
                  />
                </span>
              </span>

              <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600 sm:ml-0">
                <span>
                  {phase.done}/{phase.tasks.length}
                </span>
                {artCount > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600"
                    title={`${artCount} deliverables`}
                  >
                    <PhaseIcon paths={PHASE_ICON_PATHS.clip} className="h-3.5 w-3.5" />
                    {artCount}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {unphased && (
        <div
          className={`border-t border-slate-100 px-4 py-2 text-xs ${
            selectedPhaseId === unphased.id ? 'bg-indigo-50/70' : 'bg-slate-50/60'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectPhase(unphased.id)}
            aria-pressed={selectedPhaseId === unphased.id}
            className={`font-semibold hover:underline ${
              selectedPhaseId === unphased.id ? 'text-indigo-700' : 'text-slate-700'
            }`}
          >
            Tasks without a phase ({unphased.tasks.length})
          </button>
          <span className="text-slate-400"> · not part of the phase map</span>
        </div>
      )}
    </div>
  )
}
