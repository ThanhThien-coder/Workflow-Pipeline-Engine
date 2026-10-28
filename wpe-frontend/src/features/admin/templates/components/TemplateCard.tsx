import React from 'react';
import type { TemplateSummaryDto, TemplateCategory } from '../../../../types/template.types';
import { Layers, Copy, Trash2, ArrowUpRight } from 'lucide-react';

interface TemplateCardProps {
  template: TemplateSummaryDto;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_GRADIENTS: Record<TemplateCategory, string> = {
  'Software Engineering': 'from-blue-500 to-indigo-600',
  Marketing: 'from-pink-500 to-orange-400',
  'DevOps & Infra': 'from-emerald-500 to-teal-600',
  General: 'from-slate-500 to-slate-700',
};

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const gradient =
    CATEGORY_GRADIENTS[template.category] || CATEGORY_GRADIENTS['General'];

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
      {/* Top row: Category icon + Status badge */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}
        >
          <Layers className="h-6 w-6" />
        </div>

        {template.isSystemStandard ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-700">
            PUBLIC · SYSTEM STANDARD
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-700">
            DRAFT
          </span>
        )}
      </div>

      {/* Category header */}
      <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
        {template.category}
      </div>

      {/* Title */}
      <h3
        className="mt-1 font-bold text-slate-900 leading-snug line-clamp-1 hover:text-blue-600 cursor-pointer transition-colors"
        onClick={() => onEdit(template.id)}
        title={template.name}
      >
        {template.name}
      </h3>

      {/* Description */}
      <p className="mt-1.5 min-h-[2.75rem] text-sm text-slate-500 line-clamp-2 leading-relaxed">
        {template.description ? (
          template.description
        ) : (
          <span className="italic text-slate-400">Không có mô tả chi tiết.</span>
        )}
      </p>

      {/* Stats Counter Grid */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2 border border-slate-100">
          <div className="text-base font-extrabold text-slate-900">
            {template.phaseCount}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Phases
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-2 border border-slate-100">
          <div className="text-base font-extrabold text-slate-900">
            {template.nodeCount}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Nodes
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-2 border border-slate-100">
          <div className="text-base font-extrabold text-slate-900">
            {template.cloneCount}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Clones
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => onEdit(template.id)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 h-9 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <span>Open Studio / Edit</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDuplicate(template.id)}
          title="Duplicate template"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-95 shadow-sm"
        >
          <Copy className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(template.id)}
          title="Delete template"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 hover:border-rose-300 active:scale-95 shadow-sm"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
