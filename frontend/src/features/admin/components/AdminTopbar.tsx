import { useState, type FC, type KeyboardEvent } from 'react';
import type { AdminPortalTab } from '../../../hooks/useAdminPortal';
import { Search, Bell } from 'lucide-react';

interface AdminTopbarProps {
  currentTab: AdminPortalTab;
  onGlobalSearch: (term: string) => void;
  onNotificationClick: () => void;
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
  onNotificationClick,
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
            <span>Admin Console</span>
            <span>/</span>
            <span id="breadcrumb" className="font-semibold text-slate-600">
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
          <label className="hidden w-64 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-400 lg:flex focus-within:border-blue-400 focus-within:bg-white transition-all">
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

          <button
            id="notificationBtn"
            onClick={onNotificationClick}
            className="relative rounded-full p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
          </button>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ring-2 ring-white shadow-xs select-none"
            title="Alex Kim (Root Admin)"
          >
            AK
          </div>
        </div>
      </div>
    </header>
  );
};
