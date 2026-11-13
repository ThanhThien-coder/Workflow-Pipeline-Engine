import type { FC } from 'react';
import type { AuditLogGroup, SecurityAuditLogDto } from '../../../types/admin.types';
import { Download, ShieldCheck } from 'lucide-react';

export interface AuditLogsTabProps {
  auditLogs: SecurityAuditLogDto[];
  onExportAudit?: () => void;
  group?: AuditLogGroup | 'ALL';
  onGroupChange?: (group: AuditLogGroup | 'ALL') => void;
  errorMessage?: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  REGISTER: 'Đăng ký',
  ACCOUNT_LOCKED_LOGIN: 'Tài khoản khóa cố đăng nhập',
  USER_SUSPENDED: 'Khóa tài khoản',
  USER_UNBANNED: 'Mở khóa tài khoản',
  TEMPLATE_CREATED: 'Tạo template',
  TEMPLATE_UPDATED: 'Sửa template',
  TEMPLATE_DELETED: 'Xóa template',
};

const DANGER_ACTIONS = new Set([
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED_LOGIN',
  'USER_SUSPENDED',
  'TEMPLATE_DELETED',
]);

const FILTER_BUTTONS: { key: AuditLogGroup | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'LOGIN', label: 'Đăng nhập' },
  { key: 'ADMIN', label: 'Quản trị' },
  { key: 'TEMPLATE', label: 'Template' },
];

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '—';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleString('vi-VN');
  } catch {
    return timestamp;
  }
}

function formatTarget(targetType: string | null, targetId: string | null): string {
  if (!targetType && !targetId) {
    return '—';
  }
  if (targetType && targetId) {
    return `${targetType} #${targetId}`;
  }
  return targetType || targetId || '—';
}

function renderActionBadge(action: string) {
  const label = ACTION_LABELS[action] ?? action;
  const isDanger = DANGER_ACTIONS.has(action);

  if (isDanger) {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      {label}
    </span>
  );
}

export const AuditLogsTab: FC<AuditLogsTabProps> = ({
  auditLogs,
  onExportAudit,
  group = 'ALL',
  onGroupChange,
  errorMessage,
}) => {
  return (
    <section id="tab-audit" className="tab-panel active animate-fade">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Security &amp; Audit Logs
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Nhật ký đăng nhập và thao tác quản trị trên toàn hệ thống
          </p>
        </div>
        {onExportAudit && (
          <button
            id="exportAudit"
            type="button"
            onClick={onExportAudit}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export visible logs</span>
          </button>
        )}
      </div>

      {/* Button Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTER_BUTTONS.map((btn) => {
          const isActive = group === btn.key;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={() => onGroupChange?.(btn.key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Error or Table */}
      {errorMessage ? (
        <div className="admin-surface rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
          <p className="font-semibold">Chưa có dữ liệu: {errorMessage}</p>
        </div>
      ) : (
        <div className="admin-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Thời gian</th>
                  <th className="px-4 py-4 font-semibold">Người thực hiện</th>
                  <th className="px-4 py-4 font-semibold">Hành động</th>
                  <th className="px-4 py-4 font-semibold">Đối tượng</th>
                  <th className="px-5 py-4 font-semibold">Chi tiết</th>
                  <th className="px-5 py-4 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody id="auditBody" className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      {log.actorName}
                    </td>
                    <td className="px-4 py-4">
                      {renderActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">
                      {formatTarget(log.targetType, log.targetId)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 max-w-xs truncate" title={log.detail ?? undefined}>
                      {log.detail || '—'}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {log.maskedIp || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {auditLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
              <ShieldCheck className="h-8 w-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">Chưa có nhật ký nào</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
