import { useState, type FC } from 'react';
import type { WorkspaceOverviewDto } from '../../../types/admin.types';
import { RefreshCw, ExternalLink, Archive, X } from 'lucide-react';

interface WorkspacesTabProps {
  workspaces: WorkspaceOverviewDto[];
  onRefresh: () => Promise<void> | void;
  onInspectPipeline: (projectName: string) => void;
  onArchive?: (workspaceId: string) => Promise<void> | void;
}

export const WorkspacesTab: FC<WorkspacesTabProps> = ({
  workspaces,
  onRefresh,
  onInspectPipeline,
  onArchive,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceOverviewDto | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getStatusBadge = (status: WorkspaceOverviewDto['status']) => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            RUNNING
          </span>
        );
      case 'IDLE':
        return (
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            IDLE
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            ARCHIVED
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            FAILED
          </span>
        );
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget || !onArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(archiveTarget.id);
      setArchiveTarget(null);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <section id="tab-workspaces" className="tab-panel active animate-fade">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Workspaces &amp; DAG Pipelines
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Server-wide observability for active pipeline execution graphs.
          </p>
        </div>
        <button
          id="refreshPipelines"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-75"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh status</span>
        </button>
      </div>

      {/* Workspaces Table */}
      <div className="admin-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Project / Pipeline</th>
                <th className="px-4 py-4 font-semibold">Workspace Owner</th>
                <th className="px-4 py-4 font-semibold">Nodes</th>
                <th className="px-4 py-4 font-semibold">Completion</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody id="pipelineBody" className="divide-y divide-slate-100">
              {workspaces.map((item) => (
                <tr key={item.id} className="transition hover:bg-blue-50/30">
                  {/* Pipeline info */}
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      DAG / production cluster
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-4 text-slate-600">{item.ownerName}</td>

                  {/* Nodes */}
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {item.nodeCount} / {item.criticalPathCount} critical
                  </td>

                  {/* Progress */}
                  <td className="w-56 px-4 py-4">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">Progress</span>
                      <b className="text-slate-700">{item.progressPercentage}%</b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${item.progressPercentage}%` }}
                      ></div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">{getStatusBadge(item.status)}</td>

                  {/* Action Buttons: Inspect & Archive */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onInspectPipeline(item.name)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                      {item.status !== 'ARCHIVED' ? (
                        <button
                          onClick={() => setArchiveTarget(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                          title="Lưu trữ dự án"
                        >
                          <Archive className="h-3 w-3" />
                          <span>Archive</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs text-slate-400 font-medium">
                          Archived
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Archiving Workspace */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !isArchiving && setArchiveTarget(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            className="pop-in relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <Archive size={18} />
                </div>
                <div>
                  <h3 id="archive-modal-title" className="text-sm font-bold text-slate-900">
                    Lưu trữ dự án (Archive Workspace)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Xác nhận chuyển trạng thái dự án sang ARCHIVED
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setArchiveTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Bạn có chắc chắn muốn lưu trữ dự án <strong className="text-slate-900">{archiveTarget.name}</strong> không? Các pipeline đang chạy sẽ dừng và dự án chuyển sang trạng thái <strong>ARCHIVED</strong>.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setArchiveTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => void handleConfirmArchive()}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                <Archive size={13} />
                <span>{isArchiving ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
