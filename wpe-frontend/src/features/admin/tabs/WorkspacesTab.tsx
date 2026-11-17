import { useState, useMemo, type FC } from 'react';
import type { AdminWorkspaceDto } from '../../../types/admin.types';
import { RefreshCw, Search, Eye, Archive } from 'lucide-react';
import { ConfirmActionModal } from '../components/ConfirmActionModal';

interface WorkspacesTabProps {
  workspaces: AdminWorkspaceDto[];
  onRefresh: () => Promise<void> | void;
  onOpenDetail: (workspaceId: string) => void;
  onArchive: (workspaceId: string) => Promise<void> | void;
  errorMessage?: string;
}

const STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  DRAFT: { label: 'Draft', badgeClass: 'border-slate-200 bg-slate-50 text-slate-700' },
  PLANNING: { label: 'Planning', badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  ACTIVE: { label: 'Active', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  PAUSED: { label: 'Paused', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
  COMPLETED: { label: 'Completed', badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  INACTIVE: { label: 'Inactive', badgeClass: 'border-slate-200 bg-slate-100 text-slate-600' },
  ARCHIVED: { label: 'Archived', badgeClass: 'border-slate-200 bg-slate-100 text-slate-500' },
};

export const WorkspacesTab: FC<WorkspacesTabProps> = ({
  workspaces,
  onRefresh,
  onOpenDetail,
  onArchive,
  errorMessage,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [archiveTarget, setArchiveTarget] = useState<AdminWorkspaceDto | null>(null);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const filteredWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workspaces.filter((ws) => {
      const matchStatus = statusFilter === 'ALL' || ws.status === statusFilter;
      const matchQuery =
        !q ||
        ws.name.toLowerCase().includes(q) ||
        ws.ownerName.toLowerCase().includes(q) ||
        ws.ownerMaskedEmail.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [workspaces, searchQuery, statusFilter]);

  const formatUpdatedAt = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-US');
    } catch {
      return isoString;
    }
  };

  if (errorMessage) {
    return (
      <section id="tab-workspaces" className="tab-panel active animate-fade">
        <div className="admin-surface flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">No data available: {errorMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="tab-workspaces" className="tab-panel active animate-fade">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Manage workspaces &amp; projects
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Shows general info only. Admins can't see task content.
          </p>
        </div>
        <button
          id="refreshPipelines"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-75 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name or owner..."
            aria-label="Search projects"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Workspaces Table */}
      <div className="admin-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Name</th>
                <th className="px-4 py-4 font-semibold">Owner</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Members</th>
                <th className="px-4 py-4 font-semibold">Progress</th>
                <th className="px-4 py-4 font-semibold">Updated</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody id="pipelineBody" className="divide-y divide-slate-100">
              {filteredWorkspaces.map((item) => {
                const statusInfo = STATUS_MAP[item.status] || {
                  label: item.status,
                  badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
                };

                return (
                  <tr key={item.id} className="transition hover:bg-blue-50/30">
                    {/* Tên */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">ID: {item.id}</div>
                    </td>

                    {/* Chủ */}
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-700">{item.ownerName}</div>
                      <div className="font-mono text-xs text-slate-400">{item.ownerMaskedEmail}</div>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Thành viên */}
                    <td className="px-4 py-4 text-slate-600 font-medium">
                      {item.memberCount}
                    </td>

                    {/* Tiến độ */}
                    <td className="w-56 px-4 py-4">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          {item.doneNodeCount}/{item.nodeCount}
                        </span>
                        <b className="text-slate-700">{item.progressPercentage}%</b>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, item.progressPercentage))}%` }}
                        />
                      </div>
                    </td>

                    {/* Cập nhật */}
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatUpdatedAt(item.updatedAt)}
                    </td>

                    {/* Thao tác */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View details</span>
                        </button>

                        {item.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 cursor-pointer"
                            title="Archive project"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredWorkspaces.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700">No projects yet</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Archiving Workspace */}
      <ConfirmActionModal
        isOpen={!!archiveTarget}
        title="Archive project"
        message={`Archive "${archiveTarget?.name}"? Running pipelines will stop and the project will be marked as Archived.`}
        confirmLabel="Archive"
        tone="rose"
        onConfirm={async () => {
          if (archiveTarget) {
            await onArchive(archiveTarget.id);
            setArchiveTarget(null);
          }
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </section>
  );
};
