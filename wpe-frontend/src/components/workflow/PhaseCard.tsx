import { ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import type { MacroPhase } from '../../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'

const accentStyles = {
  emerald: { bar: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200', track: 'bg-emerald-400' },
  blue: { bar: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600 border-blue-200', track: 'bg-blue-400' },
  slate: { bar: 'bg-slate-300', pill: 'bg-slate-100 text-slate-400 border-slate-300', track: 'bg-slate-300' },
} as const

export interface PhaseCardProps {
  phase: MacroPhase
  position: { x: number; y: number }
  selected: boolean
  onClick: () => void
  onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, phaseId: string) => void
  onDragCardStart?: (event: React.MouseEvent, phaseId: string) => void
  onDeletePhase?: (phaseId: string) => void
  /** B5: người không phải owner. Không có nút xóa, cổng nối bị vô hiệu hóa, con trỏ không còn kiểu "kéo". */
  readOnly?: boolean
  /** Lời giải thích hiện trên nút bị vô hiệu hóa khi readOnly. */
  readOnlyTitle?: string
}

export function PhaseCard({
  phase,
  position,
  selected,
  onClick,
  onSpawnDown,
  onDragCardStart,
  onDeletePhase,
  readOnly = false,
  readOnlyTitle,
}: PhaseCardProps) {
  // Màu đi theo trạng thái suy ra từ task: hoàn thành -> xanh lá, đang khóa -> xám, còn lại giữ accent của Phase
  const accentKey =
    phase.status === 'COMPLETED' ? 'emerald' : phase.status === 'LOCKED' ? 'slate' : phase.accent
  const accent = accentStyles[accentKey] || accentStyles.blue

  return (
    <div
      data-phase-id={phase.id}
      role="button"
      tabIndex={0}
      onMouseDown={(event) => {
        if (event.button === 0 && !(event.target as HTMLElement).closest('button, a')) {
          onDragCardStart?.(event, phase.id)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: MACRO_CARD_W,
        height: MACRO_CARD_H,
      }}
      className={`group select-none text-left rounded-2xl bg-white border shadow-sm overflow-visible transition-shadow duration-200 ${
        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        selected
          ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-200'
          : 'border-slate-200 hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Top Accent Strip */}
      <div className={`h-1.5 w-full rounded-t-2xl ${accent.bar}`} />

      {/* Target Connection Handle (Left Port) */}
      <div
        data-target-handle="true"
        data-phase-id={phase.id}
        title="Target port (Drop connection from parent phase here)"
        className="absolute -left-3.5 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white border-2 border-slate-300 shadow-sm text-slate-400 group-hover:border-blue-500 group-hover:text-blue-500 group-hover:shadow transition-all pointer-events-none"
      >
        <ChevronRight size={13} className="ml-0.5" />
      </div>

      {/* Main Content Area */}
      <div className="p-4 h-full flex flex-col pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-1">
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              {phase.name}
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug truncate" title={phase.sub}>
              {phase.sub}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
            {onDeletePhase && !readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeletePhase(phase.id)
                }}
                title="Delete this phase"
                className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}

            {phase.locked ? (
              <span className="text-slate-300" title="Phase is locked waiting for prerequisite phases">
                <Lock size={17} />
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Inspect phase tasks and graph"
              >
                Click to inspect <ChevronRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${accent.pill}`}>
              {phase.status}
            </span>
            <span className="text-xs font-semibold text-slate-500">{phase.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${accent.track}`}
              style={{ width: `${phase.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Source Connection Handle (Right Port) */}
      <button
        type="button"
        disabled={readOnly}
        onMouseDown={(event) => {
          if (readOnly) {
            event.stopPropagation()
            return
          }
          onSpawnDown(event, phase.id)
        }}
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
        }}
        title={readOnly ? readOnlyTitle : 'Drag to another phase to connect · Or click to quickly create child phase'}
        className={`absolute -right-3.5 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white shadow-md transition-all pointer-events-auto ${
          readOnly
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-110 active:scale-95 cursor-crosshair'
        }`}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
