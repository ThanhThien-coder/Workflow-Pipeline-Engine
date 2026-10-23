import { useState, type FC, type KeyboardEvent } from 'react';
import type { AdminPortalTab } from '../../../hooks/useAdminPortal';
import { Search } from 'lucide-react';
import NotificationBell from '../../../components/common/NotificationBell';
import { GlobalProfileMenu } from '../../../components/common/GlobalProfileMenu';

interface AdminTopbarProps {
  currentTab: AdminPortalTab;
  onGlobalSearch: (term: string) => void;
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
  onGlobalSearch,
  onLogout,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const title = TAB_TITLES[currentTab] || 'Overview & Analytics';

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      onGlobalSearch(searchValue.trim());
    }
  };

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

        {/* Right: Global Search, Notification, Profile Avatar */}
        <div className="flex items-center gap-2.5">
          <label className="hidden w-48 lg:w-64 focus-within:w-80 transition-all items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-400 sm:flex focus-within:border-blue-400 focus-within:bg-white">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              id="globalSearch"
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
              placeholder="Search projects, pipelines, users..."
            />
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 font-mono shadow-xs">
              ⌘K
            </kbd>
          </label>

          <NotificationBell />

          <GlobalProfileMenu displayName="Alex Kim" roleLabel="Root Admin" onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
};
