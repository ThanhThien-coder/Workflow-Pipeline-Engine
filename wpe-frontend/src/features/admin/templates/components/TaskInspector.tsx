import React from 'react';
import type { TemplateNodeDto, JoinPolicy } from '../../../../types/template.types';
import { Info, Plus, Trash2 } from 'lucide-react';

interface TaskInspectorProps {
  selectedNode: TemplateNodeDto | null;
  onUpdateNode: (
    id: string,
    patch: Partial<Pick<TemplateNodeDto, 'title' | 'description' | 'joinPolicy'>>
  ) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
}

const typeOf = (level: number) => {
  if (level === 0) return 'Phase Root';
  if (level === 1) return 'Track';
  return 'Task';
};

export const TaskInspector: React.FC<TaskInspectorProps> = ({
  selectedNode,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
}) => {
  if (!selectedNode) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 py-1">
        <Info className="h-4 w-4 text-blue-500 shrink-0" />
        <span>
          Chọn một node trong sơ đồ hoặc kanban để chỉnh sửa. Bấm nút <strong>+</strong> ở mép
          phải node để rẽ nhánh sang phải.
        </span>
      </div>
    );
  }

  const isRoot = selectedNode.level === 0;
  const addLabel = isRoot ? 'Add Track' : 'Add Task';
  const titleLabel = isRoot ? 'Phase Title' : selectedNode.level === 1 ? 'Track Name' : 'Task Title';

  return (
    <div className="flex items-end gap-2.5 w-full flex-nowrap">
      {/* Title Input */}
      <div className="flex-1 min-w-[120px]">
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 truncate">
          {titleLabel}
        </label>
        <input
          type="text"
          value={selectedNode.title}
          onChange={(e) => onUpdateNode(selectedNode.id, { title: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
          placeholder="Nhập tên công việc..."
        />
      </div>

      {/* Join Policy Select (Only for level >= 1) */}
      {!isRoot && (
        <div className="w-36 shrink-0">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 truncate">
            Join Policy
          </label>
          <select
            value={selectedNode.joinPolicy}
            onChange={(e) =>
              onUpdateNode(selectedNode.id, {
                joinPolicy: e.target.value as JoinPolicy,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
          >
            <option value="ALL_COMPLETED">AND (Chờ đủ)</option>
            <option value="ANY_COMPLETED">OR (Chỉ cần 1)</option>
          </select>
        </div>
      )}

      {/* Add Child Button */}
      <button
        type="button"
        onClick={() => onAddChild(selectedNode.id)}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 whitespace-nowrap"
      >
        <Plus className="h-3.5 w-3.5 stroke-[3]" />
        <span>{addLabel}</span>
      </button>

      {/* Delete Button (Root cannot be deleted) */}
      {!isRoot && (
        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300 active:scale-95 shadow-sm whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
};
