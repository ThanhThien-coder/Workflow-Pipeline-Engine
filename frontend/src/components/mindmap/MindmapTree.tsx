import { useEffect, useState, useCallback } from 'react'
import type { GraphNodeMap } from '../../types/workflow.types'
import { isLaneGhost, createNewBranchNode } from '../../utils/spanningTreeLayout'
import { useEdgeRenderer } from '../../hooks/useEdgeRenderer'
import { useFlip } from '../../hooks/useFlip'
import { TreeBranch } from './TreeBranch'
import { usePanZoom } from '../../hooks/usePanZoom'
import { ZoomControls } from './ZoomControls'
import { useConnectDrag } from '../../hooks/useConnectDrag'
import type { BranchGraphNode } from '../../types/workflow.types'
import { AddNodeToolbar } from './AddNodeToolbar'

export function MindmapTree({
  nodes,
  selectedId,
  onSelect,
  mergeSelection,
  onToggleMerge,
  onGhostClick,
  onUpdateNodes,
  onAddGhost,
  onDelete,
  phaseId,
}: {
  nodes: GraphNodeMap
  selectedId: string | null
  onSelect: (id: string) => void
  mergeSelection?: Set<string>
  onToggleMerge?: (id: string) => void
  onGhostClick?: (id: string, rect: DOMRect) => void
  onUpdateNodes?: (update: (nodes: GraphNodeMap) => GraphNodeMap) => void
  onAddGhost?: (pos: { x: number; y: number; anchorId?: string }) => void
  onDelete?: (id: string) => void
  phaseId?: string
}) {
  const { wrapRef, baseRef, beamRef, drawEdges, focus } = useEdgeRenderer()
  const panZoom = usePanZoom()
  useFlip(wrapRef)
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [internalMerge, setInternalMerge] = useState(new Set<string>())
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const handleHover = useCallback((id: string | null) => {
    setHoveredNodeId(id)
    if (id) {
      focus.enter(id)
    } else {
      focus.leave()
    }
  }, [focus])

  const activeMerge = mergeSelection ?? internalMerge
  const connect = useConnectDrag(nodes, (update) => onUpdateNodes?.(update))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const roots = Object.values(nodes).filter((node) => !node.parentIds[0] || !nodes[node.parentIds[0]])
  const lane = Object.values(nodes).filter((node) => node.kind === 'ghost')
  const commit = () => { setEditingId(null); drawEdges() }
  useEffect(() => { drawEdges() }, [nodes, drawEdges])
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const spawnChild = (sourceId: string) => {
    const source = nodes[sourceId]
    if (!source || !onUpdateNodes) return
    const child = createNewBranchNode(source, nodes, phaseId)
    onUpdateNodes((current) => ({ ...current, [child.id]: child }))
    setEditingId(child.id)
    setEditValue(child.title)
    if (collapsed.has(sourceId)) {
      setCollapsed((current) => {
        const next = new Set(current)
        next.delete(sourceId)
        return next
      })
    }
  }

  const addTrack = () => {
    if (!onUpdateNodes) return
    const track = createNewBranchNode(null, nodes, phaseId)
    onUpdateNodes((current) => ({ ...current, [track.id]: track }))
    setEditingId(track.id)
    setEditValue(track.title)
  }
  const branchProps = (id: string) => ({
    id,
    nodes,
    collapsed,
    selectedId,
    mergeSelection: activeMerge,
    editingId,
    editValue,
    onSelect,
    onToggle: (value: string) => toggleSet(setCollapsed, value),
    onMerge: (value: string) => { if (onToggleMerge) onToggleMerge(value); else toggleSet(setInternalMerge, value) },
    onSpawn: () => undefined,
    onDelete: (value: string) => { onDelete?.(value); if (selectedId === value) onSelect('') },
    onEdit: (value: string) => { setEditingId(value); setEditValue(nodes[value]?.title ?? '') },
    onChange: setEditValue,
    onCommit: commit,
    onCancel: () => setEditingId(null),
    onGhostClick,
    onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, sourceId: string) => connect.startDrag(event, sourceId, () => spawnChild(sourceId)),
    onHover: handleHover,
    hoveredId: hoveredNodeId,
  })

  const handleContainerMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    panZoom.onMouseMove(event)
    const target = event.target as HTMLElement
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    const chipEl = target.closest<HTMLElement>('[data-edge-node-id]')
    const id = nodeEl?.dataset.nodeId ?? chipEl?.dataset.edgeNodeId
    if (!id && hoveredNodeId !== null) {
      handleHover(null)
    }
  }

  const handleContainerMouseLeave = () => {
    panZoom.onMouseLeave()
    handleHover(null)
  }

  const handleContainerPointerLeave = () => {
    handleHover(null)
  }

  const handleContainerMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const nodeEl = target.closest<HTMLElement>('[data-node-id]')
    const chipEl = target.closest<HTMLElement>('[data-edge-node-id]')
    const id = nodeEl?.dataset.nodeId ?? chipEl?.dataset.edgeNodeId
    if (id) {
      if (hoveredNodeId !== id) handleHover(id)
    } else if (hoveredNodeId !== null) {
      handleHover(null)
    }
  }

  return (
    <div
      ref={panZoom.viewportRef}
      className="relative h-full min-h-[320px] overflow-hidden select-none"
      onMouseDown={panZoom.onMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={panZoom.onMouseUp}
      onMouseLeave={handleContainerMouseLeave}
      onPointerLeave={handleContainerPointerLeave}
      onMouseOver={handleContainerMouseOver}
    >
      <div ref={(element) => { panZoom.contentRef.current = element; wrapRef.current = element }} style={panZoom.transform} className="relative w-max select-none">
        <svg ref={baseRef} className="absolute left-0 top-0 pointer-events-none overflow-visible" aria-hidden="true" />
        <svg ref={beamRef} className="absolute left-0 top-0 pointer-events-none overflow-visible z-20" aria-hidden="true" />
        {lane.length > 0 && <div className="shrink-0 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 px-3 pt-3 pb-4" style={{ width: 244 }}><div className="text-[9.5px] font-bold tracking-widest text-indigo-400 mb-4">GHOST LANE · TIỀN ĐỀ PHASE KHÁC</div><div className="flex flex-col gap-y-4">{lane.map((node) => <TreeBranch key={node.id} {...branchProps(node.id)} />)}</div></div>}
        <div className="relative flex items-start" style={{ gap: 56 }}>{roots.filter((node) => !isLaneGhost(node)).map((node) => <TreeBranch key={node.id} {...branchProps(node.id)} />)}</div>
      </div>
      <ZoomControls scale={panZoom.scale} onZoomIn={panZoom.zoomIn} onZoomOut={panZoom.zoomOut} onReset={panZoom.reset} />
      <AddNodeToolbar onAddTrack={addTrack} onAddGhost={(pos) => onAddGhost?.({ ...pos, anchorId: selectedId ?? undefined })} />
      {connect.line && <svg className="pointer-events-none fixed inset-0 z-40 h-screen w-screen"><line x1={connect.line.x1} y1={connect.line.y1} x2={connect.line.x2} y2={connect.line.y2} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6 5" /></svg>}
      {connect.error && <div className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg" style={{ left: connect.error.x, top: connect.error.y }}>{connect.error.message}</div>}
    </div>
  )
}
