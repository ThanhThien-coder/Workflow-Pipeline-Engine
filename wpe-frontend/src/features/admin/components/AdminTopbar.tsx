import type { FC } from 'react';
import type { AdminPortalTab } from '../../../hooks/useAdminPortal';
import NotificationBell from '../../../components/common/NotificationBell';
import { GlobalProfileMenu } from '../../../components/common/GlobalProfileMenu';

interface AdminTopbarProps {
  currentTab: AdminPortalTab;
  onLogout: () => void;
}

const TAB_TITLES: Record<AdminPortalTab, string> = {
  overview: 'Overview & Analytics',
  users: 'User Management',
  workspaces: 'Workspaces & DAGs',
  templates: 'Template Library',
  audit: 'Security & Audit Logs',
};

export const AdminTopbar: FC<AdminTopbarProps> = ({
  currentTab,
  onLogout,
}) => {
  const title = TAB_TITLES[currentTab] || 'Overview & Analytics';

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs & Page Heading */}
        <div className="min-w-0">
          <div className="mb-1 hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <span className="truncate max-w-[200px] xl:max-w-none">Admin Console</span>
            <span>/</span>
            <span id="breadcrumb" className="font-semibold text-slate-600 truncate max-w-[200px] xl:max-w-none">
              {title}
            </span>
          </div>
          <h1
            id="pageHeading"
            className="truncate text-xl font-extrabold tracking-tight text-slate-900"
          >
            {title}
          </h1>
        </div>

        {/* Right: Notification, Profile Avatar */}
        <div className="flex items-center gap-2.5">
          <NotificationBell />

          <GlobalProfileMenu displayName="Alex Kim" roleLabel="Root Admin" onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
};
