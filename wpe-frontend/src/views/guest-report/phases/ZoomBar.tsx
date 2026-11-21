import { PHASE_ICON_PATHS, PhaseIcon } from './icons'
import type { GuestPanZoomResult } from './useGuestPanZoom'

export interface ZoomBarProps {
  pz: Pick<GuestPanZoomResult, 'z' | 'zoomIn' | 'zoomOut' | 'fitAll'>
  className?: string
}

export function ZoomBar({ pz, className = '' }: ZoomBarProps) {
  const btn = 'rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  return (
    <span className={`flex items-center gap-1 text-[11px] print:hidden ${className}`}>
      <button
        type="button"
        onClick={pz.zoomOut}
        className={`${btn} p-1`}
        title="Zoom out (or Ctrl + scroll)"
        aria-label="Zoom out"
      >
        <PhaseIcon paths={PHASE_ICON_PATHS.minus} className="h-3 w-3" />
      </button>
      <span className="w-9 text-center font-semibold text-slate-600">{Math.round(pz.z * 100)}%</span>
      <button
        type="button"
        onClick={pz.zoomIn}
        className={`${btn} p-1`}
        title="Zoom in (or Ctrl + scroll)"
        aria-label="Zoom in"
      >
        <PhaseIcon paths={PHASE_ICON_PATHS.plus} className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={pz.fitAll}
        className={`${btn} px-1.5 py-0.5 font-semibold`}
        title="Show the whole graph"
      >
        Fit
      </button>
    </span>
  )
}
