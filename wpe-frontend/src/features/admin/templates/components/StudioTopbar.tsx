import React, { useState } from 'react';
import type {
  TemplateDetailDto,
  TemplateCategory,
  DagValidationResult,
} from '../../../../types/template.types';
import { DagStatusBadge } from './DagStatusBadge';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Save,
  Loader2,
  X,
} from 'lucide-react';

interface StudioTopbarProps {
  draft: TemplateDetailDto;
  isSaving: boolean;
  validation: DagValidationResult | null;
  onBack: () => void;
  onUpdateMeta: (
    patch: Partial<
      Pick<TemplateDetailDto, 'name' | 'description' | 'category' | 'isSystemStandard'>
    >
  ) => void;
  onValidate: () => void;
  onSave: () => void;
}

export const StudioTopbar: React.FC<StudioTopbarProps> = ({
  draft,
  isSaving,
  validation,
  onBack,
  onUpdateMeta,
  onValidate,
  onSave,
}) => {
  const [isDescModalOpen, setIsDescModalOpen] = useState(false);
  const [descInput, setDescInput] = useState(draft.description || '');

  const openDescModal = () => {
    setDescInput(draft.description || '');
    setIsDescModalOpen(true);
  };

  const handleDescSave = () => {
    onUpdateMeta({ description: descInput });
    setIsDescModalOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Admin</span>
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* Inline Template Title */}
        <div className="min-w-[240px] flex-1">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onUpdateMeta({ name: e.target.value })}
            placeholder="Template name"
            className="w-full rounded-xl border border-transparent px-3 py-1 text-base font-bold text-slate-900 outline-none transition hover:border-slate-200 focus:border-blue-600 focus:bg-white"
          />
        </div>

        {/* Description Button */}
        <button
          type="button"
          onClick={openDescModal}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
          title="Edit template description"
        >
          <FileText className="h-4 w-4 text-slate-400" />
          <span>Description</span>
        </button>

        {/* Category Select */}
        <select
          value={draft.category}
          onChange={(e) =>
            onUpdateMeta({ category: e.target.value as TemplateCategory })
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
        >
          <option value="Software Engineering">Software Engineering</option>
          <option value="Marketing">Marketing</option>
          <option value="DevOps & Infra">DevOps & Infra</option>
          <option value="General">General</option>
        </select>

        <div className="h-6 w-px bg-slate-200" />

        {/* Public to All Users Switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={draft.isSystemStandard}
            onClick={() => onUpdateMeta({ isSystemStandard: !draft.isSystemStandard })}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              draft.isSystemStandard ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                draft.isSystemStandard ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-slate-700">
            Public to All Users{' '}
            <span className="hidden xl:inline text-slate-400 font-normal">
              (System Standard)
            </span>
          </span>
        </label>

        {/* Validate DAG (Kahn) */}
        <button
          type="button"
          onClick={onValidate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 active:scale-95"
        >
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          <span>Validate DAG (Kahn)</span>
        </button>

        {/* Badge status */}
        <DagStatusBadge validation={validation} />

        {/* Save & Publish Button */}
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Save &amp; Publish Template</span>
        </button>
      </header>

      {/* Description Modal */}
      {isDescModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-pop">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Template Description
              </h3>
              <button
                type="button"
                onClick={() => setIsDescModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Mô tả chi tiết và hướng dẫn áp dụng mẫu này cho người dùng dự án.
            </p>

            <textarea
              rows={6}
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="Nhập mô tả chi tiết quy trình..."
              className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDescModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDescSave}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Lưu mô tả
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
