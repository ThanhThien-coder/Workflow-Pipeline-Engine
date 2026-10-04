import { ChevronRight, Lock, Plus } from 'lucide-react'
import type { MacroPhase } from '../../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'

const accentStyles = {
  emerald: { bar: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200', track: 'bg-emerald-400' },
  blue: { bar: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600 border-blue-200', track: 'bg-blue-400' },
  slate: { bar: 'bg-slate-300', pill: 'bg-slate-100 text-slate-400 border-slate-300', track: 'bg-slate-300' },
} as const

export function PhaseCard({ phase, position, selected, onClick, onSpawnDown }: { phase: MacroPhase; position: { x: number; y: number }; selected: boolean; onClick: () => void; onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, phaseId: string) => void }) {
  const accent = accentStyles[phase.accent]
  return <div data-phase-id={phase.id} role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick() }} style={{ position: 'absolute', left: position.x, top: position.y, width: MACRO_CARD_W, height: MACRO_CARD_H }} className={`group select-none text-left rounded-2xl bg-white border shadow-sm overflow-visible transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${selected ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-200' : 'border-slate-200 hover:shadow-md hover:-translate-y-0.5'}`}>
    <div className={`h-[5px] w-full ${accent.bar}`} />
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-[11px] font-bold tracking-widest text-slate-400">{phase.name}</div><div className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug">{phase.sub}</div></div>
        {phase.locked ? <span className="text-slate-300 shrink-0"><Lock size={18} /></span> : <span className="shrink-0 text-[10px] font-semibold text-indigo-500 flex items-center gap-0.5">Click to inspect <ChevronRight size={11} /></span>}
      </div>
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between mb-1.5"><span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${accent.pill}`}>{phase.status}</span><span className="text-xs font-semibold text-slate-500">{phase.pct}%</span></div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${accent.track}`} style={{ width: `${phase.pct}%` }} /></div>
      </div>
    </div>
    <button type="button" onMouseDown={(event) => onSpawnDown(event, phase.id)} onClick={(event) => { event.stopPropagation(); event.preventDefault() }} title="Kéo sang Phase khác để nối phụ thuộc · Click để tạo Phase con" className="absolute -right-3 top-1/2 z-20 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-blue-500 text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover:opacity-100 cursor-grab active:cursor-grabbing"><Plus size={13} /></button>
  </div>
}
