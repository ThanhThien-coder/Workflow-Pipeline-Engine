import { ExternalLink } from 'lucide-react'
import type { GhostGraphNode } from '../../types/workflow.types'

export function GhostInfo({ node, onOpen }: { node: GhostGraphNode; onOpen?: () => void }) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><b className="text-sm text-slate-800">Ghost Node</b><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{node.dir.toUpperCase()}</span></div>
    <div className="text-[12px] text-slate-500">Task gốc thuộc: <span className="font-semibold text-slate-700">{node.refPhase}</span></div>
    <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">Reference: <span className="font-mono text-slate-700">{node.refId}</span></div>
    {onOpen && <button onClick={onOpen} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50"><ExternalLink size={13} />Mở phase nguồn</button>}
  </div>
}
