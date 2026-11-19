import { Hand, Minus, Plus } from 'lucide-react'

/**
 * Nút zoom dùng chung cho canvas phase và cây task.
 * - Nút %: về 100%, vị trí ban đầu.
 * - Nút bàn tay: fit toàn bộ đồ thị vào khung nhìn (onFit). Không truyền onFit thì nút này cũng về 100%.
 */
export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFit, className = '' }: { scale: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; onFit?: () => void; className?: string }) {
  return <div className={`${className || 'absolute bottom-6 right-6'} z-30 flex items-center gap-1 shrink-0 whitespace-nowrap rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg select-none`}>
    <button type="button" onClick={onZoomOut} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom out"><Minus size={14} /></button>
    <button type="button" onClick={onReset} title="Reset to 100%" className="min-w-12 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">{Math.round(scale * 100)}%</button>
    <button type="button" onClick={onZoomIn} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom in"><Plus size={14} /></button>
    <button type="button" onClick={onFit ?? onReset} title="Fit graph to view" className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-indigo-500 hover:bg-indigo-50" aria-label="Fit graph to view"><Hand size={14} /></button>
  </div>
}
