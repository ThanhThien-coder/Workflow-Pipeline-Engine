import React, { useMemo } from 'react';
import type { TemplateNodeDto } from '../../../../types/template.types';
import { Plus } from 'lucide-react';

interface PhaseKanbanViewProps {
  nodes: TemplateNodeDto[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

const typeOf = (level: number) => {
  if (level === 0) return 'Phase Root';
  if (level === 1) return 'Track';
  return 'Task';
};

export const PhaseKanbanView: React.FC<PhaseKanbanViewProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onAddChild,
}) => {
  const rootNode = useMemo(() => {
    return nodes.find((n) => n.level === 0) || nodes[0];
  }, [nodes]);

  // Tracks are children of root (level 1)
  const tracks = useMemo(() => {
    if (!rootNode) return [];
    return nodes.filter((n) => n.parentId === rootNode.id && n.level === 1);
  }, [nodes, rootNode]);

  // Helper to get all descendant tasks/sub-tasks for a track
  const getTrackItems = (trackId: string): TemplateNodeDto[] => {
    const items: TemplateNodeDto[] = [];
    const seen = new Set<string>([trackId]);
    const collect = (parentId: string) => {
      const children = nodes.filter((n) => n.parentId === parentId);
      for (const c of children) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          items.push(c);
          collect(c.id);
        }
      }
    };
    collect(trackId);
    return items;
  };

  return (
    <div className="flex gap-4 p-6 items-start overflow-x-auto min-h-full">
      {tracks.map((track) => {
        const items = getTrackItems(track.id);
        const isTrackSelected = track.id === selectedNodeId;

        return (
          <div
            key={track.id}
            className="w-72 shrink-0 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-3 flex flex-col gap-2 self-start shadow-sm"
          >
            {/* Column Header: Track Node */}
            <div
              onClick={() => onSelectNode(track.id)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer transition ${
                isTrackSelected
                  ? 'bg-blue-100/80 text-blue-900 ring-2 ring-blue-600'
                  : 'hover:bg-slate-200/70'
              }`}
            >
              <span className="font-bold text-sm text-slate-900 truncate" title={track.title}>
                {track.title}
              </span>
              <span className="text-xs font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 border border-slate-200">
                {items.length}
              </span>
            </div>

            {/* Column Task Cards */}
            <div className="flex flex-col gap-2 min-h-[50px]">
              {items.map((item) => {
                const isSelected = item.id === selectedNodeId;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectNode(item.id)}
                    className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md hover:border-blue-400 select-none ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-600 shadow-md'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {typeOf(item.level)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${
                          item.joinPolicy === 'ANY_COMPLETED'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {item.joinPolicy === 'ANY_COMPLETED' ? 'OR' : 'AND'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 line-clamp-2">
                      {item.title}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Task inside Track Button */}
            <button
              type="button"
              onClick={() => onAddChild(track.id)}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 py-2 text-xs font-bold text-blue-600 transition hover:bg-white hover:border-blue-500 active:scale-98"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        );
      })}

      {/* Add Track Button (Adds child to Root) */}
      {rootNode && (
        <button
          type="button"
          onClick={() => onAddChild(rootNode.id)}
          className="w-56 shrink-0 rounded-2xl border-2 border-dashed border-blue-300 py-6 text-sm font-bold text-blue-600 transition hover:bg-white hover:border-blue-500 flex flex-col items-center justify-center gap-2 active:scale-98"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Plus className="h-4 w-4" />
          </div>
          <span>+ Add Track</span>
        </button>
      )}
    </div>
  );
};
