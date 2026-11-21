import { useEffect, useId, useMemo, useState } from 'react'
import type { GuestArtifact, GuestReportPhase } from '../../../domain/guestReport'
import { TONE, TONE_BAR } from '../ui'
import { PHASE_ICON_PATHS, PhaseIcon } from './icons'
import { PHASE_MAP_DIMS, layoutPhaseMap } from './layoutPhaseMap'
import { countPhaseArtifacts } from './taskHelpers'
import { GUEST_PAN_HINT, GUEST_ZOOM_MIN, useGuestPanZoom } from './useGuestPanZoom'
import { ZoomBar } from './ZoomBar'

const MAX_HEIGHT = 340

export interface GuestPhaseMapProps {
  phases: GuestReportPhase[]
  phaseEdges?: ReadonlyArray<ReadonlyArray<string | number>> | null
  selectedPhaseId: string | null
  artifactsByTask: Record<string, GuestArtifact[]>
  onSelectPhase: (phaseId: string) => void
}

export function GuestPhaseMap({
  phases,
  phaseEdges,
  selectedPhaseId,
  artifactsByTask,
  onSelectPhase,
}: GuestPhaseMapProps) {
  const { CW, CH, GX } = PHASE_MAP_DIMS
  const [hoverId, setHoverId] = useState<string | null>(null)
  const markerPrefix = useId().replace(/:/g, '')

  const layout = useMemo(() => layoutPhaseMap(phases, phaseEdges), [phases, phaseEdges])
  const focusId = hoverId ?? selectedPhaseId

  const pz = useGuestPanZoom(({ w }) => {
    if (layout.w === 0 || layout.h === 0) {
      return { start: 1, all: 1 }
    }
    const all = Math.min(1, (w - 4) / layout.w, (MAX_HEIGHT - 4) / layout.h)
    return {
      start: Math.min(1, Math.max(0.7, all)),
      all: Math.max(GUEST_ZOOM_MIN, all),
    }
  })

  const z = pz.z

  useEffect(() => {
    const el = pz.ref.current
    const p = selectedPhaseId ? layout.pos[selectedPhaseId] : undefined
    if (!el || !p) return
    const x = p.x * z
    const y = p.y * z
    const w = CW * z
    const h = CH * z
    const out =
      x < el.scrollLeft ||
      x + w > el.scrollLeft + el.clientWidth ||
      y < el.scrollTop ||
      y + h > el.scrollTop + el.clientHeight
    if (out) {
      el.scrollTo?.({
        left: Math.max(0, x - 40),
        top: Math.max(0, y - 20),
        behavior: 'smooth',
      })
    }
  }, [selectedPhaseId, layout, z, CW, CH, pz.ref])

  if (layout.phases.length === 0) {
    return null
  }

  const markerNormal = `${markerPrefix}-pm`
  const markerActive = `${markerPrefix}-pmOn`

  return (
    <div data-testid="guest-phase-map" className="border-b border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500 print:hidden">
        <span>
          Arrows go from a phase to the phases that start after it. Click a phase to open its tasks
          below.{' '}
          <span className="hidden text-slate-400 sm:inline">{GUEST_PAN_HINT}.</span>
        </span>
        <ZoomBar pz={pz} />
      </div>

      <div
        ref={pz.ref}
        {...pz.bind}
        className={`overflow-auto print:max-h-none print:overflow-visible ${
          pz.dragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{
          maxHeight: MAX_HEIGHT,
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: '#f8fafc',
        }}
      >
        <div style={{ width: layout.w * z, height: layout.h * z, minWidth: '100%' }}>
          <div
            className="relative"
            style={{
              width: layout.w,
              height: layout.h,
              transform: `scale(${z})`,
              transformOrigin: '0 0',
            }}
          >
            <svg width={layout.w} height={layout.h} className="pointer-events-none absolute inset-0">
              <defs>
                <marker
                  id={markerNormal}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8z" fill="#94a3b8" />
                </marker>
                <marker
                  id={markerActive}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8z" fill="#4f46e5" />
                </marker>
              </defs>

              {layout.edges.map(([a, b]) => {
                const p = layout.pos[a]
                const q = layout.pos[b]
                if (!p || !q) return null
                const x1 = p.x + CW
                const y1 = p.y + CH / 2
                const x2 = q.x - 2
                const y2 = q.y + CH / 2
                const on = focusId === a || focusId === b
                const ly = layout.lane
                const h = GX / 2
                const d =
                  layout.col[b] - layout.col[a] > 1
                    ? `M${x1},${y1} C${x1 + h},${y1} ${x1 + h},${ly} ${x1 + h + 12},${ly} L${x2 - h - 12},${ly} C${x2 - h},${ly} ${x2 - h},${y2} ${x2},${y2}`
                    : `M${x1},${y1} C${x1 + GX * 0.6},${y1} ${x2 - GX * 0.6},${y2} ${x2},${y2}`
                return (
                  <path
                    key={`${a}-${b}`}
                    d={d}
                    fill="none"
                    stroke={on ? '#4f46e5' : '#94a3b8'}
                    strokeWidth={on ? 2 : 1.3}
                    strokeDasharray={on ? '' : '4 4'}
                    opacity={focusId !== null && !on ? 0.4 : 1}
                    markerEnd={`url(#${on ? markerActive : markerNormal})`}
                  />
                )
              })}
            </svg>

            {layout.phases.map((phase) => {
              const pos = layout.pos[phase.id]
              const isSelected = phase.id === selectedPhaseId
              const artCount = countPhaseArtifacts(phase, artifactsByTask)

              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => onSelectPhase(phase.id)}
                  onMouseEnter={() => setHoverId(phase.id)}
                  onMouseLeave={() => setHoverId(null)}
                  aria-pressed={isSelected}
                  className={`absolute flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={{ left: pos.x, top: pos.y, width: CW, height: CH }}
                >
                  <span className={`h-1.5 w-full shrink-0 ${TONE_BAR[phase.verdict.tone]}`} />
                  <span className="flex flex-1 flex-col justify-between px-3 py-2">
                    <span>
                      <span className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                        <span>Phase {phase.index + 1}</span>
                        {isSelected && <span className="text-indigo-600">Viewing</span>}
                      </span>
                      <span
                        className="line-clamp-1 text-xs font-bold text-slate-900"
                        title={phase.name}
                      >
                        {phase.name}
                      </span>
                    </span>

                    <span
                      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${
                        TONE[phase.verdict.tone] ?? TONE.slate
                      }`}
                    >
                      {phase.verdict.label}
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`block h-full ${phase.end ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                          style={{ width: `${phase.pct}%` }}
                        />
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span>
                          {phase.done}/{phase.tasks.length}
                        </span>
                        {artCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-indigo-600">
                            <PhaseIcon paths={PHASE_ICON_PATHS.clip} className="h-3 w-3" />
                            {artCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
