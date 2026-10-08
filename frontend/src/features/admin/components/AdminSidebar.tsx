import type { FC } from 'react';
import type { AdminPortalTab } from '../../../hooks/useAdminPortal';
import {
  BarChart3,
  Users,
  Zap,
  ShieldCheck,
  LogOut,
  Workflow,
  Layers,
} from 'lucide-react';

import { useRouter } from '../../../router/useRouter';

interface AdminSidebarProps {
  currentTab: AdminPortalTab;
  onTabChange: (tab: AdminPortalTab) => void;
  onLogout: () => void;
}

interface NavItem {
  id: AdminPortalTab;
  label: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview & Analytics', icon: BarChart3 },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'workspaces', label: 'Workspaces & DAGs', icon: Zap },
  { id: 'templates', label: 'Template Library', icon: Layers },
  { id: 'audit', label: 'Security & Audit Logs', icon: ShieldCheck },
];

export const AdminSidebar: FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  onLogout,
}) => {
  const { navigate } = useRouter();

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside
        id="sidebar"
        className="sticky top-0 z-30 hidden md:flex h-screen w-20 lg:w-72 shrink-0 flex-col border-r border-slate-200 bg-white"
      >
        {/* Brand */}
        <div
          onClick={() => navigate('/workspaces')}
          className="brand flex items-center justify-center lg:justify-start gap-3 border-b border-slate-100 px-4 lg:px-5 py-5 cursor-pointer hover:bg-slate-50/80 transition-colors"
          title="Return to Pipelines & Workspaces"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
            <Workflow className="h-5 w-5" />
          </div>
          <div className="brand-copy hidden min-w-0 lg:block">
            <div className="truncate text-sm font-extrabold tracking-tight text-slate-900">
              Pipeline Engine
            </div>
            <span className="mt-1 inline-flex rounded-md bg-purple-50 px-2 py-0.5 text-[9px] font-bold tracking-[.12em] text-purple-700 ring-1 ring-inset ring-purple-200">
              SUPER ADMIN
            </span>
          </div>
        </div>


        {/* Navigation items */}
        <nav className="flex-1 space-y-1 px-2 lg:px-3 py-5" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group flex w-full items-center justify-center lg:justify-start gap-3 rounded-l-lg px-3 py-3 text-left text-sm transition border-r-4 ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/80 font-semibold text-blue-600'
                    : 'border-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                }`}
                title={item.label}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                  }`}
                />
                <span className="nav-label hidden lg:inline truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Profile Footer */}
        <div className="border-t border-slate-100 p-3 lg:p-4">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-sm">
              AK
            </div>
            <div className="profile-copy hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-sm font-bold text-slate-800">Alex Kim</div>
              <div className="truncate text-xs text-slate-400">Root Admin</div>
            </div>
            <button
              onClick={onLogout}
              className="logout-label hidden lg:inline-flex rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="Đăng xuất"
            >
              Đăng xuất
            </button>
            <button
              onClick={onLogout}
              className="lg:hidden p-1.5 text-slate-400 hover:text-rose-600"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav fixed bottom-4 left-4 right-4 z-30 flex items-center justify-around rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`mobile-tab rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isActive ? 'text-blue-600 bg-blue-50/70 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.id === 'overview'
                ? 'Overview'
                : item.id === 'users'
                ? 'Users'
                : item.id === 'workspaces'
                ? 'DAGs'
                : item.id === 'templates'
                ? 'Templates'
                : 'Audit'}
            </button>
          );
        })}
      </div>
    </>
  );
};
