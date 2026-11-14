import type { FC } from 'react';
import type { AdminStatsDto, AdminTrendPointDto } from '../../../types/admin.types';
import { Users, PlayCircle, AlertCircle, Copy, Info } from 'lucide-react';

interface AnalyticsTabProps {
  stats: AdminStatsDto | null;
  trends: AdminTrendPointDto[];
  trendRange: '7D' | '30D';
  onRangeChange: (range: '7D' | '30D') => void;
  errorMessage?: string;
  loading?: boolean;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PLANNING: 'Lập kế hoạch',
  ACTIVE: 'Đang chạy',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  INACTIVE: 'Không hoạt động',
  ARCHIVED: 'Lưu trữ',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  PLANNING: 'bg-blue-500',
  ACTIVE: 'bg-emerald-500',
  PAUSED: 'bg-amber-500',
  COMPLETED: 'bg-indigo-500',
  INACTIVE: 'bg-slate-300',
  ARCHIVED: 'bg-slate-500',
};

export const AnalyticsTab: FC<AnalyticsTabProps> = ({
  stats,
  trends,
  trendRange,
  onRangeChange,
  errorMessage,
  loading,
}) => {
  if (errorMessage) {
    return (
      <section id="tab-overview" className="tab-panel active animate-fade">
        <div className="admin-surface flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Chưa có dữ liệu: {errorMessage}</p>
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section id="tab-overview" className="tab-panel active animate-fade">
        <div className="admin-surface flex flex-col items-center justify-center p-12 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">
            {loading ? 'Đang tải...' : 'Đang tải...'}
          </p>
        </div>
      </section>
    );
  }

  const activeProjectsCount = stats.projects.byStatus['ACTIVE'] ?? 0;

  // Tìm giá trị max để tính tỉ lệ chiều cao cột biểu đồ
  const maxTrendVal = Math.max(
    1,
    ...trends.map((t) => Math.max(t.newUsers, t.newProjects, t.tasksDone))
  );

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  const projectStatuses = ['DRAFT', 'PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'INACTIVE', 'ARCHIVED'];

  return (
    <section id="tab-overview" className="tab-panel active animate-fade">
      {/* 4 Hàng KPI */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Người dùng */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Người dùng</span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {stats.users.total.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            đang khóa {stats.users.suspended}, mới 7 ngày {stats.users.newLast7Days}
          </div>
        </div>

        {/* KPI 2: Dự án đang chạy */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Dự án đang chạy</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <PlayCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-700">
            {activeProjectsCount.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            tổng {stats.projects.total}, mới 7 ngày {stats.projects.newLast7Days}
          </div>
        </div>

        {/* KPI 3: Task trễ hạn */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Task trễ hạn</span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-rose-600">
            {stats.tasks.overdue.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            tổng task {stats.tasks.total}
          </div>
        </div>

        {/* KPI 4: Template */}
        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Template</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Copy className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {stats.templates.publicCount.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            riêng tư {stats.templates.privateCount}, lượt dùng {stats.templates.totalClones}
          </div>
        </div>
      </div>

      {/* Biểu đồ xu hướng 7D/30D */}
      <div className="admin-surface mb-6 p-6">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Xu hướng hoạt động</h2>
            <p className="text-xs text-slate-500">
              Biến động người dùng mới, dự án mới và tác vụ hoàn thành theo ngày.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Chú thích màu */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 mr-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                <span>User mới</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" />
                <span>Dự án mới</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Task xong</span>
              </div>
            </div>

            {/* Toggle 7D / 30D */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => onRangeChange('7D')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  trendRange === '7D'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                7 Ngày
              </button>
              <button
                type="button"
                onClick={() => onRangeChange('30D')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  trendRange === '30D'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                30 Ngày
              </button>
            </div>
          </div>
        </div>

        {/* Cột biểu đồ vẽ bằng div Tailwind */}
        <div className="mt-6 flex h-64 items-end gap-1.5 overflow-x-auto pb-6 pt-4 border-b border-slate-100">
          {trends.map((item) => {
            const userHeight = Math.round((item.newUsers / maxTrendVal) * 100);
            const projHeight = Math.round((item.newProjects / maxTrendVal) * 100);
            const taskHeight = Math.round((item.tasksDone / maxTrendVal) * 100);

            return (
              <div
                key={item.date}
                className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center h-full justify-end group"
              >
                {/* 3 cột con */}
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  {/* User mới */}
                  <div
                    title={`${item.date}: ${item.newUsers} người dùng mới`}
                    style={{ height: `${Math.max(item.newUsers > 0 ? 8 : 0, userHeight)}%` }}
                    className="w-1.5 sm:w-2 rounded-t bg-blue-600 transition-all group-hover:brightness-110"
                  />
                  {/* Dự án mới */}
                  <div
                    title={`${item.date}: ${item.newProjects} dự án mới`}
                    style={{ height: `${Math.max(item.newProjects > 0 ? 8 : 0, projHeight)}%` }}
                    className="w-1.5 sm:w-2 rounded-t bg-indigo-500 transition-all group-hover:brightness-110"
                  />
                  {/* Task xong */}
                  <div
                    title={`${item.date}: ${item.tasksDone} task xong`}
                    style={{ height: `${Math.max(item.tasksDone > 0 ? 8 : 0, taskHeight)}%` }}
                    className="w-1.5 sm:w-2 rounded-t bg-emerald-500 transition-all group-hover:brightness-110"
                  />
                </div>
                {/* Nhãn ngày */}
                <span className="mt-2 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {formatShortDate(item.date)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ghi chú nhỏ */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Task xong tính theo ngày cập nhật cuối</span>
        </div>
      </div>

      {/* Grid: Phân bố trạng thái dự án + Phân bố vai trò */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Phân bố trạng thái dự án (thanh ngang) */}
        <div className="admin-surface p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-1">
            Phân bố trạng thái dự án
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Tổng số: {stats.projects.total} dự án trên hệ thống
          </p>

          <div className="space-y-3">
            {projectStatuses.map((st) => {
              const count = stats.projects.byStatus[st] ?? 0;
              const pct = stats.projects.total > 0 ? Math.round((count / stats.projects.total) * 100) : 0;
              const label = PROJECT_STATUS_LABELS[st] || st;
              const colorClass = PROJECT_STATUS_COLORS[st] || 'bg-slate-400';

              return (
                <div key={st}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">
                      {label} ({st})
                    </span>
                    <span className="text-slate-500 font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      title={`${label}: ${count} (${pct}%)`}
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phân bố vai trò */}
        <div className="admin-surface p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              Phân bố vai trò
            </h2>
            <p className="text-xs text-slate-400">
              Phân bổ tài khoản hệ thống và vai trò trong các dự án
            </p>
          </div>

          {/* Vai trò hệ thống */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Vai trò hệ thống
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white p-3 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">Quản trị viên (ADMIN)</span>
                <b className="text-lg text-blue-700">
                  {stats.roles.systemRoles['ADMIN'] ?? 0}
                </b>
              </div>
              <div className="rounded-lg bg-white p-3 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">Người dùng (USER)</span>
                <b className="text-lg text-slate-800">
                  {stats.roles.systemRoles['USER'] ?? 0}
                </b>
              </div>
            </div>
          </div>

          {/* Vai trò trong dự án */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Vai trò trong dự án
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">OWNER</span>
                <b className="text-base text-slate-800">
                  {stats.roles.projectRoles['OWNER'] ?? 0}
                </b>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">MANAGER</span>
                <b className="text-base text-slate-800">
                  {stats.roles.projectRoles['MANAGER'] ?? 0}
                </b>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">COLLAB</span>
                <b className="text-base text-slate-800">
                  {stats.roles.projectRoles['COLLABORATOR'] ?? 0}
                </b>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                <span className="text-[11px] text-slate-400 block">VIEWER</span>
                <b className="text-base text-slate-800">
                  {stats.roles.projectRoles['VIEWER'] ?? 0}
                </b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
