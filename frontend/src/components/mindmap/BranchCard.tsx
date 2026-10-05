import { Check, ChevronDown, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import type { ChangeEvent, MouseEvent } from 'react'
import type { BranchGraphNode } from '../../types/workflow.types'
import type { GraphNodeMap } from '../../types/workflow.types'
import { W } from '../../utils/spanningTreeLayout'

const statusStyles = {
  DONE: { c: 'text-emerald-600 bg-emerald-50 border-emerald-200', bd: 'border-emerald-300', lbl: 'Done' },
  IN_PROGRESS: { c: 'text-blue-600 bg-blue-50 border-blue-200', bd: 'border-blue-300', lbl: 'In progress' },
  TODO: { c: 'text-sky-600 bg-sky-50 border-sky-200', bd: 'border-sky-300', lbl: 'To do' },
  LOCKED: { c: 'text-slate-400 bg-slate-100 border-slate-200', bd: 'border-slate-200', lbl: 'Locked' },
  REVIEW: { c: 'text-amber-600 bg-amber-50 border-amber-200', bd: 'border-amber-300', lbl: 'Review' },
} as const

function EditableTitle({ title, editing, value, onChange, onCommit, onCancel, className }: { title: string; editing: boolean; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onCommit: () => void; onCancel: () => void; className: string }) {
  if (!editing) return <div className={`${className} pointer-events-none`}>{title || '—'}</div>
  return <input autoFocus value={value} onChange={onChange} onKeyDown={(event) => { if (event.key === 'Enter') onCommit(); if (event.key === 'Escape') onCancel() }} onBlur={onCommit} placeholder="Task title…" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className="w-full select-text cursor-text text-[12px] font-semibold text-slate-800 bg-white border-2 border-blue-400 rounded px-1.5 py-0.5 outline-none" />
}

export function BranchCard({ node, nodes, hasChildren, collapsed, selected, merged, editing, editValue, onSelect, onToggleCollapse, onToggleMerge, onSpawnDown, onDelete, onUpdate, onEdit, onChange, onCommit, onCancel, onHover, isHovered }: {
  node: BranchGraphNode; hasChildren: boolean; collapsed: boolean; selected: boolean; merged: boolean; editing: boolean; editValue: string
  nodes: GraphNodeMap
  onSelect: (event: MouseEvent<HTMLElement>) => void; onToggleCollapse: () => void; onToggleMerge: () => void; onSpawnDown: (event: MouseEvent<HTMLButtonElement>, sourceId: string) => void; onDelete: () => void; onUpdate: (title: string) => void; onEdit: () => void; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onCommit: () => void; onCancel: () => void
  onHover?: (id: string | null) => void; isHovered?: boolean
}) {
  const style = statusStyles[node.status]
  const assignee = node.assignee
  const count = node.parentIds.length
  return <div
    data-node-id={node.id}
    data-parents={node.parentIds.join(',')}
    data-primary={node.parentIds[0] || ''}
    data-status={node.status}
    style={{ width: node.isTrack ? W.track : W.task }}
    className={`group relative shrink-0 select-none rounded-xl bg-white border shadow-sm transition-all duration-200 ${
      node.isTrack ? 'px-3 py-2.5' : 'p-2.5 cursor-pointer'
    } ${
      merged
        ? 'border-amber-300 ring-2 ring-amber-100'
        : selected
        ? 'border-indigo-300 ring-2 ring-indigo-200'
        : isHovered
        ? 'border-indigo-400 ring-2 ring-indigo-400/60 shadow-md'
        : `${style.bd} hover:shadow-md`
    }`}
    onClick={onSelect}
    onMouseEnter={() => onHover?.(node.id)}
    onMouseLeave={() => onHover?.(null)}
  >
    {hasChildren && <button onClick={(event) => { event.stopPropagation(); onToggleCollapse() }} className="absolute -left-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-5 h-5 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 z-10">{collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}</button>}
    {!node.isTrack && <button onClick={(event) => { event.stopPropagation(); onToggleMerge() }} title="Select to converge" className={`absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center w-5 h-5 rounded-full bg-white border ${merged ? 'border-amber-400 text-amber-500 opacity-100' : 'border-slate-300 text-slate-300'} z-10`}><Check size={10} /></button>}
    <button onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete() }} title="Delete" className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-400 hover:text-rose-500 hover:border-rose-300 z-10"><Trash2 size={10} /></button>
    <button onMouseDown={(event) => onSpawnDown(event, node.id)} onClick={(event) => { event.stopPropagation(); event.preventDefault() }} title="Connect to parent / Click to add sub-task" className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center w-6 h-6 rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow z-10 cursor-grab active:cursor-grabbing"><Plus size={13} /></button>
    <div className="pointer-events-none flex items-center justify-between gap-2">
      <span className={`select-none inline-flex items-center gap-1 text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 border ${style.c} pointer-events-none`}>{node.status === 'LOCKED' && <Lock size={9} />}{style.lbl}</span>
      {!node.isTrack && assignee && <span style={{ width: 18, height: 18 }} className="select-none rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white text-[8px] font-bold grid place-items-center pointer-events-none">{assignee[0]}</span>}
    </div>
    {count >= 2 && <button onClick={(event) => { event.stopPropagation(); onToggleMerge() }} className="select-none mt-1 inline-flex items-center gap-1 text-[8.5px] font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5"><span className="pointer-events-none">AND-Join · {count} prerequisites</span></button>}
    {node.parentIds.filter((parentId) => nodes[parentId]?.kind === 'ghost').map((parentId) => (
      <span
        key={parentId}
        data-edge-node-id={parentId}
        onMouseEnter={(event) => { event.stopPropagation(); onHover?.(parentId) }}
        onMouseLeave={(event) => { event.stopPropagation(); onHover?.(node.id) }}
        className="select-none mt-1 mr-1 inline-flex max-w-full cursor-pointer items-center truncate rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[8.5px] font-bold text-purple-600 hover:bg-purple-100 transition-colors"
      >
        <span className="pointer-events-none truncate">[Waiting: {nodes[parentId]?.title || parentId}]</span>
      </span>
    ))}
    <div onDoubleClick={(event) => { event.stopPropagation(); onEdit() }} className="mt-1.5"><EditableTitle title={node.title} editing={editing} value={editValue} onChange={onChange} onCommit={onCommit} onCancel={onCancel} className={node.isTrack ? 'text-[12px] font-semibold text-slate-800 leading-tight' : 'text-[12px] font-semibold text-slate-800 leading-snug'} /></div>
    {typeof node.progress === 'number' && <div className="mt-1.5 pointer-events-none"><div className="h-1 rounded-full bg-slate-100 overflow-hidden pointer-events-none"><div className="h-full rounded-full bg-blue-400 pointer-events-none" style={{ width: `${node.progress}%` }} /></div><div className="text-[9px] text-slate-400 mt-0.5 pointer-events-none">{node.progress}%</div></div>}
  </div>
}
