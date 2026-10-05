import type { GhostGraphNode } from '../../types/workflow.types'
import { W } from '../../utils/spanningTreeLayout'
import { Plus, Trash2 } from 'lucide-react'

export function GhostCard({ node, onSpawnDown, onDelete, onHover, isHovered }: { node: GhostGraphNode; onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, sourceId: string) => void; onDelete: () => void; onHover?: (id: string | null) => void; isHovered?: boolean }) {
  return <div
    data-node-id={node.id}
    data-parents={node.parentIds.join(',')}
    data-primary={node.parentIds[0] || ''}
    data-status={node.kind}
    data-ghost="1"
    style={{ width: W.ghost }}
    className={`group relative shrink-0 select-none rounded-xl border-2 border-dashed border-indigo-300/80 bg-slate-50/70 backdrop-blur-[1px] px-2.5 pt-4 pb-2.5 cursor-pointer hover:bg-indigo-50/60 transition-all duration-200 ${
      isHovered ? 'ring-2 ring-indigo-400 shadow-md' : ''
    }`}
    onMouseEnter={() => onHover?.(node.id)}
    onMouseLeave={() => onHover?.(null)}
  >
    <span className="pointer-events-none absolute -top-2.5 left-2 max-w-[calc(100%-2.5rem)] truncate text-[9px] font-bold tracking-wide text-indigo-500 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">[GHOST · {node.refPhase}]</span>
    <span className="pointer-events-none block truncate pr-3 text-[11px] font-medium text-slate-600">{node.title}</span>
    <button type="button" onClick={(event) => { event.stopPropagation(); event.preventDefault(); onDelete() }} title="Delete" className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-400 hover:text-rose-500 hover:border-rose-300 z-20 cursor-pointer"><Trash2 size={10} /></button>
    <button onMouseDown={(event) => onSpawnDown(event, node.id)} onClick={(event) => { event.stopPropagation(); event.preventDefault() }} title="Connect dependency" className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center w-6 h-6 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 shadow z-10 cursor-grab active:cursor-grabbing"><Plus size={13} /></button>
  </div>
}
