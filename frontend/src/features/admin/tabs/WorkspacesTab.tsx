import { useState, type FC } from 'react';
import type { WorkspaceOverviewDto } from '../../../types/admin.types';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface WorkspacesTabProps {
  workspaces: WorkspaceOverviewDto[];
  onRefresh: () => Promise<void> | void;
  onInspectPipeline: (projectName: string) => void;
}

export const WorkspacesTab: FC<WorkspacesTabProps> = ({
  workspaces,
  onRefresh,
  onInspectPipeline,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      case 'FAILED':
      default:
        return (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            FAILED
          </span>
        );
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
                <th className="px-5 py-4 text-right font-semibold">Inspect</th>
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

                  {/* Inspect Button */}
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onInspectPipeline(item.name)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      <span>Inspect Pipeline</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
