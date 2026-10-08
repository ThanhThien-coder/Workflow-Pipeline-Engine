import React, { useMemo } from 'react';
import type { TemplateNodeDto } from '../../../../types/template.types';
import {
  calculateTreeLayoutWithBounds,
  NODE_W,
  NODE_H,
  PAD,
} from '../../../../lib/graph/treeLayout';
import { Plus } from 'lucide-react';

interface TreeGraphViewProps {
  nodes: TemplateNodeDto[];
  selectedNodeId: string | null;
  cycleNodeIds: Set<string>;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

const typeOf = (level: number) => {
  if (level === 0) return 'Phase Root';
  if (level === 1) return 'Track';
  if (level === 2) return 'Task';
  return 'Sub-task';
};

// Memoized individual Node Card with ISOLATED hover (CSS only, zero parent layout re-render)
const TreeNodeCard = React.memo(
  ({
    node,
    x,
    y,
    isSelected,
    isViolating,
    onSelect,
    onAdd,
  }: {
    node: TemplateNodeDto;
    x: number;
    y: number;
    isSelected: boolean;
    isViolating: boolean;
    onSelect: (id: string) => void;
    onAdd: (id: string) => void;
  }) => {
    const isRoot = node.level === 0;

    const baseStyles = isRoot
      ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100'
      : node.level === 1
      ? 'bg-blue-50/90 border-blue-200 text-slate-900 shadow-blue-50'
      : node.level === 2
      ? 'bg-white border-slate-200/90 text-slate-900 shadow-slate-100'
      : 'bg-slate-50 border-slate-200 text-slate-800';

    return (
      <div
        onClick={() => onSelect(node.id)}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${NODE_W}px`,
          height: `${NODE_H}px`,
        }}
        className={`group absolute cursor-pointer rounded-2xl border px-3 py-2 shadow-sm transition-all duration-150 hover:shadow-md hover:border-blue-400 select-none ${baseStyles} ${
          isSelected ? 'ring-2 ring-blue-600 shadow-md' : ''
        } ${isViolating ? 'border-rose-500 ring-2 ring-rose-300' : ''}`}
      >
        {/* Header: Type and Join Policy */}
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isRoot ? 'text-indigo-200' : 'text-slate-400'
            }`}
          >
            {typeOf(node.level)}
          </span>

          {node.level >= 1 && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${
                node.joinPolicy === 'ANY_COMPLETED'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {node.joinPolicy === 'ANY_COMPLETED' ? 'OR' : 'AND'}
            </span>
          )}
        </div>

        {/* Node Title */}
        <div
          className={`mt-0.5 text-xs font-bold leading-snug line-clamp-2 ${
            isRoot ? 'text-white' : 'text-slate-900'
          }`}
          title={node.title}
        >
          {node.title}
        </div>

        {/* Plus Button to add child on the right edge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd(node.id);
          }}
          title={`Add child to ${node.title}`}
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-transform hover:bg-blue-700 hover:scale-110 active:scale-95 z-20"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3]" />
        </button>
      </div>
    );
  }
);

TreeNodeCard.displayName = 'TreeNodeCard';

export const TreeGraphView: React.FC<TreeGraphViewProps> = ({
  nodes,
  selectedNodeId,
  cycleNodeIds,
  onSelectNode,
  onAddChild,
}) => {
  // Pure layout calculation - only recomputes when nodes change
  const layout = useMemo(() => {
    return calculateTreeLayoutWithBounds(nodes);
  }, [nodes]);

  // Create child lookup for SVG connecting lines
  const childrenMap = useMemo(() => {
    const map = new Map<string, TemplateNodeDto[]>();
    for (const n of nodes) {
      if (n.parentId) {
        if (!map.has(n.parentId)) {
          map.set(n.parentId, []);
        }
        map.get(n.parentId)!.push(n);
      }
    }
    return map;
  }, [nodes]);

  const canvasWidth = layout.width + PAD * 2 + 100;
  const canvasHeight = layout.height + PAD * 2 + 60;

  return (
    <div
      className="relative min-w-full select-none"
      style={{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
      }}
    >
      {/* SVG Connecting Bezier lines */}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
      >
        {nodes.map((parent) => {
          const children = childrenMap.get(parent.id) || [];
          const parentPos = layout.positions.get(parent.id);
          if (!parentPos || children.length === 0) return null;

          const x1 = parentPos.x + NODE_W + PAD;
          const y1 = parentPos.y + NODE_H / 2 + PAD;

          return children.map((child) => {
            const childPos = layout.positions.get(child.id);
            if (!childPos) return null;

            const x2 = childPos.x + PAD;
            const y2 = childPos.y + NODE_H / 2 + PAD;
            const dx = (x2 - x1) / 2;

            const isCycle =
              cycleNodeIds.has(parent.id) && cycleNodeIds.has(child.id);

            return (
              <path
                key={`wire-${parent.id}-${child.id}`}
                d={`M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isCycle ? '#ef4444' : '#94a3b8'}
                strokeWidth={isCycle ? 2.5 : 2}
              />
            );
          });
        })}
      </svg>

      {/* Node Cards */}
      {nodes.map((node) => {
        const pos = layout.positions.get(node.id);
        if (!pos) return null;

        return (
          <TreeNodeCard
            key={node.id}
            node={node}
            x={pos.x + PAD}
            y={pos.y + PAD}
            isSelected={node.id === selectedNodeId}
            isViolating={cycleNodeIds.has(node.id)}
            onSelect={onSelectNode}
            onAdd={onAddChild}
          />
        );
      })}
    </div>
  );
};
