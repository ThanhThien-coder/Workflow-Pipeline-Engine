import type { MouseEvent } from 'react'
import type { BranchGraphNode, GhostGraphNode, GraphNode, GraphNodeMap } from '../../types/workflow.types'
import { resolveTrackIdForNode, type DeterministicNodePosition, CARD_DIMENSIONS } from '../../utils/spanningTreeLayout'
import { BranchCard } from './BranchCard'
import { GhostCard } from './GhostCard'

export interface TaskNodeItemProps {
  node: GraphNode
  nodes: GraphNodeMap
  pos: DeterministicNodePosition
  isHovered: boolean
  isSelected: boolean
  isMerged: boolean
  isEditing: boolean
  editValue: string
  collapsed: boolean
  hasChildren: boolean
  onSelect: (id: string) => void
  onToggleCollapse: (id: string) => void
  onToggleMerge: (id: string) => void
  onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, sourceId: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  onGhostClick?: (id: string, rect: DOMRect) => void
  onHover: (id: string | null) => void
  onAddChild?: (parentId: string) => void
  onAddTask?: (trackId: string) => void
  onAddSibling?: (trackId: string, insertAfterTaskId?: string) => void
  /** B5: người không phải owner, truyền xuống thẻ node để ẩn nút sửa. */
  readOnly?: boolean
}

export function TaskNodeItem({
  node,
  nodes,
  pos,
  isHovered,
  isSelected,
  isMerged,
  isEditing,
  editValue,
  collapsed,
  hasChildren,
  onSelect,
  onToggleCollapse,
  onToggleMerge,
  onSpawnDown,
  onDelete,
  onEdit,
  onChange,
  onCommit,
  onCancel,
  onGhostClick,
  onHover,
  onAddChild,
  onAddTask,
  onAddSibling,
  readOnly = false,
}: TaskNodeItemProps) {
  // BƯỚC 2: CỐ ĐỊNH KÍCH THƯỚC VÀ DÙNG TỌA ĐỘ TUYỆT ĐỐI (ABSOLUTE POSITIONING)
  const nodeStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${node.width || pos.width}px`,
    height: `${node.height || pos.height}px`,
  }

  if (node.kind === 'root') {
    return (
      <div
        data-node-id={node.id}
        data-parents=""
        data-primary=""
        data-status="root"
        style={nodeStyle}
        className={`box-border select-none rounded-2xl bg-indigo-900 text-white shadow-lg px-4 py-3 cursor-pointer transition-colors duration-150 ${
          isHovered ? 'ring-2 ring-indigo-400 shadow-indigo-500/20 shadow-xl' : ''
        }`}
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold pointer-events-none">
          Root
        </div>
        <div className="text-sm font-semibold mt-0.5 leading-snug pointer-events-none truncate">
          {node.title}
        </div>
      </div>
    )
  }

  if (node.kind === 'ghost') {
    return (
      <div
        data-node-id={node.id}
        style={{
          ...nodeStyle,
          height: `${pos.height || node.height || CARD_DIMENSIONS.GHOST_HEIGHT}px`,
        }}
        className="box-border"
        onClick={(event) =>
          onGhostClick?.(node.id, event.currentTarget.getBoundingClientRect())
        }
      >
        <GhostCard
          node={node as GhostGraphNode}
          onSpawnDown={onSpawnDown}
          onDelete={() => onDelete(node.id)}
          onHover={onHover}
          isHovered={isHovered}
          readOnly={readOnly}
        />
      </div>
    )
  }

  const branch = node as BranchGraphNode
  const resolvedTrackId = branch.isTrack
    ? branch.id
    : branch.trackId || resolveTrackIdForNode(branch, nodes) || ''

  return (
    <div
      data-node-id={node.id}
      style={nodeStyle}
      className="box-border"
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <BranchCard
        node={branch}
        nodes={nodes}
        hasChildren={hasChildren}
        collapsed={collapsed}
        selected={isSelected}
        merged={isMerged}
        editing={isEditing}
        editValue={editValue}
        onSelect={(event: MouseEvent<HTMLElement>) => {
          if (event.shiftKey) onToggleMerge(node.id)
          else onSelect(node.id)
        }}
        onToggleCollapse={() => onToggleCollapse(node.id)}
        onToggleMerge={() => onToggleMerge(node.id)}
        onSpawnDown={onSpawnDown}
        onDelete={() => onDelete(node.id)}
        onUpdate={onCommit}
        onEdit={() => onEdit(node.id)}
        onChange={(event) => onChange(event.target.value)}
        onCommit={onCommit}
        onCancel={onCancel}
        onHover={onHover}
        isHovered={isHovered}
        readOnly={readOnly}
        onAddChild={
          onAddChild
            ? () => onAddChild(branch.id)
            : undefined
        }
        onAddTask={
          branch.isTrack && onAddTask
            ? () => onAddTask(branch.id)
            : undefined
        }
        onAddSibling={
          !branch.isTrack && onAddSibling && resolvedTrackId
            ? () => onAddSibling(resolvedTrackId, branch.id)
            : undefined
        }
      />
    </div>
  )
}
