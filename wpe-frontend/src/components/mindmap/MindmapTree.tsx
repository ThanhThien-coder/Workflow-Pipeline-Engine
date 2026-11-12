import { useState, useCallback, useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { GraphNodeMap, BranchGraphNode } from '../../types/workflow.types'
import {
  calculatePhaseGraphLayout,
  createNewBranchNode,
  childrenOfPrimary,
  resolveTrackIdForNode,
} from '../../utils/spanningTreeLayout'
import { usePanZoom } from '../../hooks/usePanZoom'
import { ZoomControls } from './ZoomControls'
import { useConnectDrag } from '../../hooks/useConnectDrag'
import { AddNodeToolbar } from './AddNodeToolbar'
import { TaskNodeItem } from './TaskNodeItem'
import { GRAPH_READ_ONLY_MESSAGE } from '../../store/useWorkflowStore'

/**
 * Tìm cạnh mới mà một lần kéo-nối vừa thêm: so cây trước và sau, node nào có thêm cha.
 * useConnectDrag (ngoài phạm vi B5) chỉ trả hàm cập nhật cây, nên phải so để biết cha và con.
 */
function findAddedEdge(before: GraphNodeMap, after: GraphNodeMap): { parentId: string; childId: string } | null {
  for (const [id, node] of Object.entries(after)) {
    const added = node.parentIds.find((p) => !(before[id]?.parentIds ?? []).includes(p))
    if (added) return { parentId: added, childId: id }
  }
  return null
}

export function MindmapTree({
  nodes,
  selectedId,
  onSelect,
  mergeSelection,
  onToggleMerge,
  onGhostClick,
  onUpdateNodes,
  onAddGhost,
  onAddRootTask,
  onDelete,
  phaseId,
  readOnly = false,
  onConnectNodes,
}: {
  /** B5: người không phải owner. Không thêm, xóa, nối, sửa tên node; vẫn pan, zoom, chọn, xem chi tiết. */
  readOnly?: boolean
  /**
   * B5: có thì kéo-nối 2 node gọi hàm này (gọi API) thay vì chỉ sửa cây cục bộ.
   * Nhận id node cha (nguồn kéo) và node con (đích thả).
   */
  onConnectNodes?: (parentId: string, childId: string) => void
  nodes: GraphNodeMap
  selectedId: string | null
  onSelect: (id: string) => void
  mergeSelection?: Set<string>
  onToggleMerge?: (id: string) => void
  onGhostClick?: (id: string, rect: DOMRect) => void
  onUpdateNodes?: (update: (nodes: GraphNodeMap) => GraphNodeMap) => void
  onAddGhost?: (pos: { x: number; y: number; anchorId?: string }) => void
  onAddRootTask?: () => void
  onDelete?: (id: string) => void
  phaseId?: string
}) {
  const panZoom = usePanZoom()
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const [internalMerge, setInternalMerge] = useState(new Set<string>())
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const activeMerge = mergeSelection ?? internalMerge
  const connect = useConnectDrag(nodes, (update) => {
    if (readOnly) return
    if (onConnectNodes) {
      const edge = findAddedEdge(nodes, update(nodes))
      if (edge) onConnectNodes(edge.parentId, edge.childId)
      return
    }
    onUpdateNodes?.(update)
  })

  // BƯỚC 1: CÔ LẬP HOÀN TOÀN TÍNH TOÁN TỌA ĐỘ KHỎI STATE HOVER - SSOT LAYOUT ENGINE
  const { layoutNodes, layoutEdges } = useMemo(() => {
    const layout = calculatePhaseGraphLayout(nodes, collapsed)
    return layout
  }, [nodes, collapsed]) // Tuyệt đối KHÔNG đưa hoveredNodeId vào dependency này!

  // Canvas bounds computed deterministically from layoutNodes
  const canvasSize = useMemo(() => {
    if (layoutNodes.length === 0) return { width: 1400, height: 800 }
    const maxX = Math.max(...layoutNodes.map((p) => p.right))
    const maxY = Math.max(...layoutNodes.map((p) => p.y + p.height))
    return {
      width: Math.max(1400, maxX + 300),
      height: Math.max(700, maxY + 300),
    }
  }, [layoutNodes])

  const handleHover = useCallback((id: string | null) => {
    setHoveredNodeId(id)
  }, [])

  const commit = useCallback(() => {
    setEditingId(null)
  }, [])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleMerge = useCallback((id: string) => {
    if (onToggleMerge) {
      onToggleMerge(id)
    } else {
      setInternalMerge((current) => {
        const next = new Set(current)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }, [onToggleMerge])

  // Pure Data Action: Tạo Node con phân rã của bất kỳ Node nào (Root, Track, Task, Subtask...)
  const handleAddChild = useCallback(
    (parentId: string) => {
      if (readOnly || !parentId || !onUpdateNodes) return
      const parentNode = nodes[parentId]
      if (!parentNode) return

      // Lấy danh sách các node con trực tiếp hiện tại của parentNode
      const existingChildren = Object.values(nodes).filter(
        (n) =>
          n.parentIds.includes(parentId) ||
          (n as BranchGraphNode).parentId === parentId
      )
      const newOrder = existingChildren.length

      const child = createNewBranchNode(
        parentNode,
        nodes,
        phaseId,
        undefined,
        newOrder
      )

      onUpdateNodes((current) => ({
        ...current,
        [child.id]: child,
      }))
      setEditingId(child.id)
      setEditValue(child.title)
      if (collapsed.has(parentId)) {
        setCollapsed((current) => {
          const next = new Set(current)
          next.delete(parentId)
          return next
        })
      }
    },
    [readOnly, nodes, onUpdateNodes, phaseId, collapsed]
  )

  const handleAddTask = useCallback(
    (targetTrackId: string) => {
      handleAddChild(targetTrackId)
    },
    [handleAddChild]
  )

  const spawnChild = useCallback(
    (sourceId: string) => {
      handleAddChild(sourceId)
    },
    [handleAddChild]
  )

  const addTrack = useCallback(() => {
    if (readOnly || !onUpdateNodes) return
    const track = createNewBranchNode(null, nodes, phaseId)
    onUpdateNodes((current) => ({ ...current, [track.id]: track }))
    setEditingId(track.id)
    setEditValue(track.title)

    // Smoothly pan canvas if newly created track is below the visible viewport
    if (panZoom.viewportRef.current) {
      const vh = panZoom.viewportRef.current.clientHeight
      const existingTracksCount = Object.values(nodes).filter(
        (n) => n.kind === 'branch' && (n as BranchGraphNode).isTrack
      ).length
      const estimatedY = 60 + existingTracksCount * 120
      const currentBottom = (estimatedY + 64) * panZoom.scale + panZoom.pan.y
      if (currentBottom > vh - 100) {
        panZoom.setPan((current) => ({
          ...current,
          y: Math.min(current.y, vh - 120 - (estimatedY + 64) * panZoom.scale),
        }))
      }
    }
  }, [readOnly, nodes, onUpdateNodes, phaseId, panZoom])

  const handleContainerMouseLeave = () => {
    panZoom.onMouseLeave()
    handleHover(null)
  }

  return (
    <div
      ref={panZoom.viewportRef}
      className="relative w-full h-full min-h-[320px] overflow-hidden select-none"
      onScroll={(e) => {
        // Enforce canvas viewport never scrolls natively; panning is handled via usePanZoom
        e.currentTarget.scrollTop = 0
        e.currentTarget.scrollLeft = 0
      }}
      onMouseDown={panZoom.onMouseDown}
      onMouseMove={panZoom.onMouseMove}
      onMouseUp={panZoom.onMouseUp}
      onMouseLeave={handleContainerMouseLeave}
    >
      <div
        ref={panZoom.contentRef}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          ...panZoom.transform,
        }}
        className="relative select-none"
      >
        {/* 1. Lớp SVG vẽ tất cả dây nối (Render từ layoutEdges SSOT) */}
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={canvasSize.width}
          height={canvasSize.height}
          aria-hidden="true"
        >
          {/* Base / Dimmed Edges */}
          {layoutEdges.map((edge) => {
            const isHoverActive = Boolean(hoveredNodeId)
            const isUpstream = hoveredNodeId === edge.targetId
            const isDownstream = hoveredNodeId === edge.sourceId
            const isLit = isUpstream || isDownstream

            if (isLit) return null

            return (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={edge.isGhost ? '#818cf8' : '#cbd5e1'}
                strokeWidth={edge.isGhost ? '2' : '1.5'}
                strokeDasharray={edge.isGhost ? '6 4' : !edge.direct ? '4 4' : undefined}
                opacity={isHoverActive ? (edge.isGhost ? 0.3 : 0.08) : 1}
                className={edge.isGhost ? 'transition-opacity duration-150 animate-ghost-dash' : 'transition-opacity duration-150'}
              />
            )
          })}

          {/* Lit / Hover Highlighted Edges */}
          {layoutEdges.map((edge) => {
            const isUpstream = hoveredNodeId === edge.targetId
            const isDownstream = hoveredNodeId === edge.sourceId
            if (!isUpstream && !isDownstream) return null

            const strokeColor = isUpstream ? '#2563eb' : '#10b981'
            const shadowColor = isUpstream
              ? 'rgba(37,99,235,0.65)'
              : 'rgba(16,185,129,0.65)'

            return (
              <path
                key={`lit-${edge.id}`}
                d={edge.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={edge.direct ? undefined : '6 4'}
                style={{ filter: `drop-shadow(0 0 3px ${shadowColor})` }}
              />
            )
          })}
        </svg>

        {/* 2. Lớp DOM vẽ tất cả các Node (Render phẳng hoàn toàn từ layoutNodes) */}
        {layoutNodes.map((layoutNode) => {
          const node = nodes[layoutNode.id]
          if (!node) return null

          const allKids = childrenOfPrimary(nodes, node.id).filter(
            (child) => child.kind !== 'ghost'
          )

          return (
            <TaskNodeItem
              key={node.id}
              node={node}
              nodes={nodes}
              pos={layoutNode}
              isHovered={hoveredNodeId === node.id}
              isSelected={selectedId === node.id}
              isMerged={activeMerge.has(node.id)}
              isEditing={editingId === node.id}
              editValue={editValue}
              collapsed={collapsed.has(node.id)}
              hasChildren={allKids.length > 0}
              onSelect={onSelect}
              onToggleCollapse={toggleCollapse}
              onToggleMerge={toggleMerge}
              onAddChild={handleAddChild}
              onAddTask={handleAddTask}
              onAddSibling={handleAddChild}
              onSpawnDown={(event, sourceId) => {
                if (readOnly) return
                connect.startDrag(event, sourceId, () => {
                  handleAddChild(sourceId)
                })
              }}
              readOnly={readOnly}
              onDelete={(id) => {
                onDelete?.(id)
                if (selectedId === id) onSelect('')
              }}
              onEdit={(id) => {
                if (readOnly) return
                setEditingId(id)
                setEditValue(nodes[id]?.title ?? '')
              }}
              onChange={setEditValue}
              onCommit={commit}
              onCancel={() => setEditingId(null)}
              onGhostClick={onGhostClick}
              onHover={handleHover}
            />
          )
        })}
      </div>

      <ZoomControls
        scale={panZoom.scale}
        onZoomIn={panZoom.zoomIn}
        onZoomOut={panZoom.zoomOut}
        onReset={panZoom.reset}
      />

      <AddNodeToolbar
        disabledReason={readOnly ? GRAPH_READ_ONLY_MESSAGE : undefined}
        onAddTrack={onAddRootTask || addTrack}
        onAddGhost={(pos) =>
          onAddGhost?.({
            x: pos?.x ?? 0,
            y: pos?.y ?? 0,
            anchorId: pos?.anchorId ?? (selectedId ?? undefined),
          })
        }
      />

      {phaseId && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset Phase Tree to clean initial state?')) {
                void useWorkflowStore.getState().resetPhaseTree(phaseId)
              }
            }}
            title="Reset Phase Tree (Khôi phục trạng thái gốc / Restore clean initial state)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold border border-slate-200 hover:border-rose-300 shadow-sm transition-all backdrop-blur-sm cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset Phase Tree</span>
          </button>
        </div>
      )}

      {connect.line && (
        <svg className="pointer-events-none fixed inset-0 z-40 h-screen w-screen">
          <line
            x1={connect.line.x1}
            y1={connect.line.y1}
            x2={connect.line.x2}
            y2={connect.line.y2}
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
        </svg>
      )}

      {connect.error && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: connect.error.x, top: connect.error.y }}
        >
          {connect.error.message}
        </div>
      )}
    </div>
  )
}
