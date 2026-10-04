import { AlertCircle, RotateCcw } from 'lucide-react'

interface KahnCycleModalProps {
  violatingNodeIds: string[] | null
  onClose: () => void
}

export function KahnCycleModal({ violatingNodeIds, onClose }: KahnCycleModalProps) {
  if (!violatingNodeIds || violatingNodeIds.length === 0) return null

  const cyclePath = violatingNodeIds.join(' → ')

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Cycle Detected! (HTTP 400)</h3>
            <p className="text-xs text-slate-500">Pipeline validation error</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/70 p-4 text-xs text-slate-700">
          <p className="leading-relaxed">
            Cannot publish pipeline. A circular dependency cycle was detected by{' '}
            <strong className="font-semibold text-slate-900">Kahn's Topological Sort Algorithm</strong>:
          </p>

          <div className="rounded-lg border border-red-200 bg-white p-3 font-mono text-[12px] font-bold text-red-700 shadow-2xs">
            {cyclePath}
          </div>

          <p className="text-[11px] text-slate-500">
            Please remove circular parent-child relationships in the Workflow Editor before attempting to publish.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <RotateCcw size={14} />
            <span>Back to editor</span>
          </button>
        </div>
      </div>
    </div>
  )
}
