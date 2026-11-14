import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { container } from '../../../services/container';
import type {
  TemplateSummaryDto,
  TemplateCategory,
  CreateTemplateRequestDto,
} from '../../../types/template.types';
import { TemplateCard } from './components/TemplateCard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Search, Plus, RefreshCw, AlertCircle, Sparkles, Layers } from 'lucide-react';

interface TemplateCatalogViewProps {
  onOpenStudio: (templateId: string | null) => void;
  onToast: (msg: string, tone?: 'blue' | 'rose' | 'emerald') => void;
}

export const TemplateCatalogView: React.FC<TemplateCatalogViewProps> = ({
  onOpenStudio,
  onToast,
}) => {
  const [templates, setTemplates] = useState<TemplateSummaryDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [category, setCategory] = useState<TemplateCategory | 'All'>('All');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummaryDto | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load templates from container DI
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await container.templateService.getTemplates({ visibility: 'PUBLIC' });
      setTemplates(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách template';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Reactive cache invalidation: Listen to template updates and route changes
  useEffect(() => {
    const handleUpdate = () => {
      void fetchTemplates();
    };

    window.addEventListener('wpe_template_updated', handleUpdate);
    window.addEventListener('wpe_route_change', handleUpdate);

    return () => {
      window.removeEventListener('wpe_template_updated', handleUpdate);
      window.removeEventListener('wpe_route_change', handleUpdate);
    };
  }, [fetchTemplates]);

  // Filtered list
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesCategory = category === 'All' || t.category === category;
      const q = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [templates, category, debouncedSearch]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Actions
  const handleDuplicate = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const original = await container.templateService.getTemplateById(id);
      const copyPayload: CreateTemplateRequestDto = {
        name: `${original.name} (Copy)`,
        description: original.description || '',
        category: original.category,
        isSystemStandard: false, // Rule: Always DRAFT
        graphData: original.graphData,
      };

      await container.templateService.createTemplate(copyPayload);
      onToast('Đã nhân bản template (trạng thái DRAFT)', 'blue');
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi nhân bản template';
      onToast(msg, 'rose');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await container.templateService.deleteTemplate(deleteTarget.id);
      onToast('Đã xóa template', 'blue');
      setDeleteTarget(null);
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa template';
      onToast(msg, 'rose');
    }
  };


  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              System Pipeline Templates
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              <Sparkles className="h-3 w-3" />
              v2 Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Quản lý kho mẫu quy trình chuẩn toàn hệ thống. Người dùng có thể clone các mẫu
            công khai khi khởi tạo dự án.
          </p>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Chỉ hiện template công khai. Template riêng của người dùng chỉ hiện ở màn tạo dự án của chính họ.
          </p>
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => {
            if (isProcessing) return;
            setIsProcessing(true);
            onOpenStudio(null);
            setTimeout(() => setIsProcessing(false), 400);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Template</span>
        </button>
      </div>

      {/* 2. Controls & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mô tả template..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TemplateCategory | 'All')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:w-56"
        >
          <option value="All">All Categories</option>
          <option value="Software Engineering">Software Engineering</option>
          <option value="Marketing">Marketing</option>
          <option value="DevOps & Infra">DevOps & Infra</option>
          <option value="General">General</option>
        </select>
      </div>

      {/* 3. Counter */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Hiển thị <strong className="text-slate-700">{filteredTemplates.length}</strong> /{' '}
          {templates.length} templates
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-blue-600 font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Đang đồng bộ...
          </span>
        )}
      </div>

      {/* 4. Main Grid Viewport */}
      {loading && templates.length === 0 ? (
        // Loading Skeleton
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
              <div className="mt-4 h-4 w-1/3 rounded bg-slate-200" />
              <div className="mt-2 h-6 w-3/4 rounded bg-slate-200" />
              <div className="mt-2 h-12 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        // Error state
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <h3 className="mt-2 text-base font-bold text-slate-900">Không thể tải dữ liệu</h3>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchTemplates}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        // Empty / No Results
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Không tìm thấy template phù hợp
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {search || category !== 'All'
              ? 'Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa danh mục.'
              : 'Chưa có template nào được tạo. Hãy bấm "+ Create Template" để bắt đầu.'}
          </p>
          {(search || category !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        // Template Cards Grid
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={(id) => onOpenStudio(id)}
              onDuplicate={(id) => handleDuplicate(id)}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete template?"
        message={
          deleteTarget?.isSystemStandard
            ? `"${deleteTarget?.name}" là template mẫu của hệ thống. Xóa vĩnh viễn thì người dùng không chọn được mẫu này khi tạo dự án nữa. Các dự án đã tạo trước đó không bị ảnh hưởng.`
            : `"${deleteTarget?.name}" sẽ bị xóa khỏi kho mẫu. Các dự án đã clone trước đó không bị ảnh hưởng.`
        }
        confirmLabel="Delete"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
