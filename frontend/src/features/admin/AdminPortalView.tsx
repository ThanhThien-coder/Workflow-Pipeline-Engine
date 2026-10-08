import { useState, useEffect, type FC } from 'react';
import { useAdminPortal } from '../../hooks/useAdminPortal';
import { useRouter } from '../../router/useRouter';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminTopbar } from './components/AdminTopbar';
import { BanConfirmModal } from './components/BanConfirmModal';
import { AdminToast } from './components/AdminToast';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { UserManagementTab } from './tabs/UserManagementTab';
import { WorkspacesTab } from './tabs/WorkspacesTab';
import { AuditLogsTab } from './tabs/AuditLogsTab';
import { TemplateCatalogView } from './templates/TemplateCatalogView';
import { TemplateStudioView } from './templates/TemplateStudioView';

export const AdminPortalView: FC = () => {
  const {
    currentTab,
    setCurrentTab,
    filteredUsers,
    kpis,
    trends,
    trendRange,
    handleTrendRangeChange,
    roleDistribution,
    workspaces,
    auditLogs,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    // Ban Modal
    isBanModalOpen,
    selectedUserToBan,
    banReason,
    setBanReason,
    openBanModal,
    closeBanModal,
    handleSuspendUser,
    handleUnbanUser,
    // Workspaces
    handleRefreshWorkspaces,
    // Toast
    toasts,
    showToast,
    dismissToast,
  } = useAdminPortal();

  const { pathname, navigate } = useRouter();
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Sync route with tab and studio state
  useEffect(() => {
    if (pathname === '/admin/templates') {
      setCurrentTab('templates');
      setIsStudioOpen(false);
      setEditingTemplateId(null);
    } else if (pathname === '/admin/templates/new') {
      setCurrentTab('templates');
      setIsStudioOpen(true);
      setEditingTemplateId(null);
    } else if (pathname.startsWith('/admin/templates/') && pathname.endsWith('/studio')) {
      const match = pathname.match(/^\/admin\/templates\/([^/]+)\/studio$/);
      if (match && match[1]) {
        setCurrentTab('templates');
        setIsStudioOpen(true);
        setEditingTemplateId(match[1]);
      }
    }
  }, [pathname, setCurrentTab]);

  const handleOpenStudio = (templateId: string | null) => {
    setIsStudioOpen(true);
    setEditingTemplateId(templateId);
    if (templateId) {
      navigate(`/admin/templates/${templateId}/studio`);
    } else {
      navigate('/admin/templates/new');
    }
  };

  const handleCloseStudio = () => {
    setIsStudioOpen(false);
    setEditingTemplateId(null);
    navigate('/admin/templates');
  };

  const handleTabChange = (tab: typeof currentTab) => {
    setCurrentTab(tab);
    if (tab === 'templates') {
      navigate('/admin/templates');
    }
  };

  const handleGlobalSearch = (term: string) => {
    setCurrentTab('users');
    setSearchQuery(term);
  };

  const handleLogout = () => {
    showToast('Đây là bản demo — phiên đăng nhập vẫn được giữ nguyên.');
  };

  const handleInspectPipeline = (projectName: string) => {
    showToast(`Đang mở inspector: ${projectName}`);
  };

  const handleExportAudit = () => {
    showToast('Bản export audit log đã sẵn sàng trong bản demo.', 'emerald');
  };

  return (
    <div className="flex min-h-screen admin-grid-bg text-slate-700 antialiased font-sans">
      {/* 1. Left Sidebar Navigation */}
      <AdminSidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
      />

      {/* 2. Main Content Viewport */}
      <main className="min-w-0 flex-1 h-screen overflow-y-auto">
        {/* Top Header */}
        <AdminTopbar
          currentTab={currentTab}
          onGlobalSearch={handleGlobalSearch}
          onLogout={handleLogout}
        />

        {/* Tab View Container */}
        <div className="p-4 pb-24 md:p-8">
          {currentTab === 'overview' && (
            <AnalyticsTab
              kpis={kpis}
              trends={trends}
              trendRange={trendRange}
              onRangeChange={handleTrendRangeChange}
              roleDistribution={roleDistribution}
            />
          )}

          {currentTab === 'users' && (
            <UserManagementTab
              users={filteredUsers}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onOpenBanModal={openBanModal}
              onUnban={handleUnbanUser}
            />
          )}

          {currentTab === 'workspaces' && (
            <WorkspacesTab
              workspaces={workspaces}
              onRefresh={handleRefreshWorkspaces}
              onInspectPipeline={handleInspectPipeline}
            />
          )}

          {currentTab === 'templates' && (
            <TemplateCatalogView
              onOpenStudio={handleOpenStudio}
              onToast={(msg, tone) => showToast(msg, tone || 'blue')}
            />
          )}

          {currentTab === 'audit' && (
            <AuditLogsTab
              auditLogs={auditLogs}
              onExportAudit={handleExportAudit}
            />
          )}
        </div>

        {/* Floating Live Environment Indicator */}
        <div className="fixed bottom-5 right-5 z-30 hidden items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-[10px] font-bold tracking-wide text-blue-700 shadow-lg sm:flex select-none">
          ⚡ DEV <span className="text-slate-300">|</span> ADMIN{' '}
          <span className="text-slate-300">|</span> LIVE{' '}
          <span className="animate-pulse">⌃</span>
        </div>
      </main>

      {/* Visual Template Studio Modal Overlay */}
      {isStudioOpen && (
        <TemplateStudioView
          templateId={editingTemplateId}
          onClose={handleCloseStudio}
          onToast={(msg, tone) => showToast(msg, tone || 'blue')}
        />
      )}

      {/* 3. Ban / Suspend Confirmation Modal */}
      <BanConfirmModal
        isOpen={isBanModalOpen}
        user={selectedUserToBan}
        reason={banReason}
        onReasonChange={setBanReason}
        onConfirm={(userId, reason) => handleSuspendUser(userId, reason)}
        onClose={closeBanModal}
      />

      {/* 4. Floating Toast Host */}
      <AdminToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
