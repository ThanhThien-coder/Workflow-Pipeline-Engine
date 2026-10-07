import type { FC } from 'react';
import type { SecurityAuditLogDto } from '../../../types/admin.types';
import { Download, ShieldCheck } from 'lucide-react';

interface AuditLogsTabProps {
  auditLogs: SecurityAuditLogDto[];
  onExportAudit: () => void;
}

export const AuditLogsTab: FC<AuditLogsTabProps> = ({
  auditLogs,
  onExportAudit,
}) => {
  const getStatusBadge = (status: SecurityAuditLogDto['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            SUCCESS
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            WARNING
          </span>
        );
      case 'BLOCKED':
      default:
        return (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            BLOCKED
          </span>
        );
    }
  };

  return (
    <section id="tab-audit" className="tab-panel active animate-fade">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Security &amp; Audit Logs
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Immutable trace of privileged actions and authentication events.
          </p>
        </div>
        <button
          id="exportAudit"
          onClick={onExportAudit}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>Export visible logs</span>
        </button>
      </div>

      {/* Audit Logs Table */}
      <div className="admin-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Timestamp (ISO)</th>
                <th className="px-4 py-4 font-semibold">Actor</th>
                <th className="px-4 py-4 font-semibold">Action</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Source IP (Masked)</th>
              </tr>
            </thead>
            <tbody id="auditBody" className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="transition hover:bg-blue-50/30">
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">
                    {log.timestamp}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {log.actorName}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-4">{getStatusBadge(log.status)}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">
                    {log.maskedIp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {auditLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
            <ShieldCheck className="h-8 w-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">Chưa có nhật ký truy vết</p>
          </div>
        )}
      </div>
    </section>
  );
};
