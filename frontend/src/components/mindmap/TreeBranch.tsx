import type { MouseEvent } from 'react'
import type { BranchGraphNode, GraphNode, GraphNodeMap } from '../../types/workflow.types'
import { GAP_X, W, childrenOfPrimary } from '../../utils/spanningTreeLayout'
import { BranchCard } from './BranchCard'
import { GhostCard } from './GhostCard'

export function TreeBranch({ id, nodes, collapsed, selectedId, mergeSelection, editingId, editValue, onSelect, onToggle, onMerge, onSpawn, onDelete, onEdit, onChange, onCommit, onCancel, onGhostClick, onSpawnDown }: {
  id: string; nodes: GraphNodeMap; collapsed: Set<string>; selectedId: string | null; mergeSelection: Set<string>; editingId: string | null; editValue: string
  onSelect: (id: string) => void; onToggle: (id: string) => void; onMerge: (id: string) => void; onSpawn: (id: string) => void; onDelete: (id: string) => void; onEdit: (id: string) => void; onChange: (value: string) => void; onCommit: () => void; onCancel: () => void
  onGhostClick?: (id: string, rect: DOMRect) => void
  onSpawnDown: (event: MouseEvent<HTMLButtonElement>, sourceId: string) => void
}) {
  const node = nodes[id]
  if (!node) return null
  const allKids = childrenOfPrimary(nodes, id).filter((child) => child.kind !== 'ghost')
  const kids = collapsed.has(id) ? [] : allKids
  const select = (event: MouseEvent<HTMLElement>) => {
    if (event.shiftKey) onMerge(id)
    else if (node.kind === 'branch') onSelect(id)
  }
  const card = node.kind === 'root'
    ? <div data-node-id={node.id} data-parents={node.parentIds.join(',')} data-primary={node.parentIds[0] || ''} data-status={node.kind} style={{ width: W.root }} className="relative shrink-0 select-none rounded-2xl bg-indigo-900 text-white shadow-lg px-4 py-3" onClick={select}><div className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Root</div><div className="text-sm font-semibold mt-0.5 leading-snug">{node.title}</div></div>
    : node.kind === 'ghost'
      ? <div onClick={(event) => onGhostClick?.(node.id, event.currentTarget.getBoundingClientRect())}><GhostCard node={node} onSpawnDown={onSpawnDown} onDelete={() => onDelete(id)} /></div>
      : <BranchCard node={node as BranchGraphNode} nodes={nodes} hasChildren={allKids.length > 0} collapsed={collapsed.has(id)} selected={selectedId === id} merged={mergeSelection.has(id)} editing={editingId === id} editValue={editValue} onSelect={select} onToggleCollapse={() => onToggle(id)} onToggleMerge={() => onMerge(id)} onSpawnDown={onSpawnDown} onDelete={() => onDelete(id)} onUpdate={() => onCommit()} onEdit={() => onEdit(id)} onChange={(event) => onChange(event.target.value)} onCommit={onCommit} onCancel={onCancel} />
  const colGap = id === 'root' ? 'gap-y-5' : 'gap-y-3'
  return <div className="flex items-center shrink-0" style={{ gap: GAP_X }}>{card}{kids.length > 0 && <div className={`flex flex-col items-start ${colGap}`}>{kids.map((child) => <TreeBranch key={child.id} id={child.id} nodes={nodes} collapsed={collapsed} selectedId={selectedId} mergeSelection={mergeSelection} editingId={editingId} editValue={editValue} onSelect={onSelect} onToggle={onToggle} onMerge={onMerge} onSpawn={onSpawn} onDelete={onDelete} onEdit={onEdit} onChange={onChange} onCommit={onCommit} onCancel={onCancel} onGhostClick={onGhostClick} onSpawnDown={onSpawnDown} />)}</div>}</div>
}
