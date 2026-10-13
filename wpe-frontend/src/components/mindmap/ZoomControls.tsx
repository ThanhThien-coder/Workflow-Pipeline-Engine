import { Hand, Minus, Plus } from 'lucide-react'

export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, className = '' }: { scale: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; className?: string }) {
  return <div className={`${className || 'absolute bottom-4 right-4'} z-30 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg`}>
    <button onClick={onZoomOut} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom out"><Minus size={14} /></button>
    <button onClick={onReset} className="min-w-12 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">{Math.round(scale * 100)}%</button>
    <button onClick={onZoomIn} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom in"><Plus size={14} /></button>
    <button onClick={onReset} className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-indigo-500 hover:bg-indigo-50" aria-label="Reset pan and zoom"><Hand size={14} /></button>
  </div>
}
