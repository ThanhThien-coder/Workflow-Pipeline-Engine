import type { FC } from 'react';
import type { AdminUserDto, AdminRole, UserAccountStatus } from '../../../types/admin.types';
import { Search, ShieldAlert, Shield } from 'lucide-react';

interface UserManagementTabProps {
  users: AdminUserDto[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  onStatusFilterChange: (status: 'ALL' | 'ACTIVE' | 'SUSPENDED') => void;
  onOpenBanModal: (user: AdminUserDto) => void;
  onUnban: (userId: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRoleBadge(role: AdminRole) {
  const styles: Record<AdminRole, string> = {
    SUPER_ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
    STANDARD_USER: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  const label = role === 'STANDARD_USER' ? 'MEMBER' : role;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[role] || 'bg-slate-50 text-slate-600 border-slate-200'
      }`}
    >
      {label}
    </span>
  );
}

function formatStatusBadge(status: UserAccountStatus) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        status === 'ACTIVE'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {status}
    </span>
  );
}

function formatCreatedAt(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('vi-VN');
  } catch {
    return isoString;
  }
}

export const UserManagementTab: FC<UserManagementTabProps> = ({
  users,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onOpenBanModal,
  onUnban,
}) => {
  return (
    <section id="tab-users" className="tab-panel active animate-fade">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage access with privacy-safe identifiers. Emails and IP addresses are masked.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <Shield className="h-3.5 w-3.5" />
          GDPR privacy mode
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="admin-surface mb-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              id="userSearch"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
              placeholder="Tìm theo họ tên, username hoặc ID..."
            />
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')
            }
            aria-label="Filter users by account status"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="admin-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[930px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">User Info</th>
                <th className="px-4 py-4 font-semibold">Masked Email</th>
                <th className="px-4 py-4 font-semibold">Role</th>
                <th className="px-4 py-4 font-semibold">Workspaces</th>
                <th className="px-4 py-4 font-semibold">Ngày tạo</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody id="userTableBody" className="divide-y divide-slate-100">
              {users.map((user) => {
                const initials = getInitials(user.name);
                const isSuperAdmin = user.role === 'SUPER_ADMIN';

                return (
                  <tr key={user.id} className="transition hover:bg-blue-50/30">
                    {/* User Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-xs font-bold text-indigo-700 select-none">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{user.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{user.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Masked Email */}
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">
                      {user.maskedEmail}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">{formatRoleBadge(user.role)}</td>

                    {/* Workspaces */}
                    <td className="px-4 py-4 text-slate-600">
                      Sở hữu {user.ownedProjectCount} · Tham gia {user.joinedProjectCount}
                    </td>

                    {/* Ngày tạo */}
                    <td className="px-4 py-4">
                      <div className="text-xs text-slate-600">
                        {formatCreatedAt(user.createdAt)}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">{formatStatusBadge(user.status)}</td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      {isSuperAdmin ? (
                        <button
                          disabled
                          title="Không thể khóa Root Admin"
                          className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-300"
                        >
                          Suspend
                        </button>
                      ) : user.status === 'ACTIVE' ? (
                        <button
                          onClick={() => onOpenBanModal(user)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Suspend / Ban
                        </button>
                      ) : (
                        <button
                          onClick={() => onUnban(user.id)}
                          className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Unban
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {users.length === 0 && (
          <div
            id="emptyUsers"
            className="flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500"
          >
            <ShieldAlert className="h-8 w-8 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">Không tìm thấy người dùng phù hợp.</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc trạng thái.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
