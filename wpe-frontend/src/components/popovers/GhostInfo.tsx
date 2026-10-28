import { ExternalLink } from 'lucide-react'
import type { GhostGraphNode } from '../../types/workflow.types'

export function GhostInfo({ node, onOpen }: { node?: GhostGraphNode | null; onOpen?: () => void }) {
  if (!node) return null

  const dirLabel = (node.dir || 'up').toUpperCase()
  const phaseLabel = node.sourcePhaseTitle || node.refPhase || 'External Phase'
  const taskLabel = node.sourceTaskTitle || node.title || node.refId

  return (
    <div className="space-y-2.5 select-none text-slate-800">
      <div className="flex items-center justify-between">
        <b className="text-sm font-bold text-slate-900">Ghost Prerequisite</b>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
          {dirLabel}
        </span>
      </div>
      <div className="text-[12px] text-slate-600">
        Source Phase: <span className="font-semibold text-slate-900">{phaseLabel}</span>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-600">
        Referenced Task: <span className="font-bold text-slate-900">{taskLabel}</span>
      </div>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
        >
          <ExternalLink size={13} />
          <span>Open source phase</span>
        </button>
      )}
    </div>
  )
}
