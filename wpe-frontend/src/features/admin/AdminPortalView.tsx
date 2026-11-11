import { useState, useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminPortal } from '../../hooks/useAdminPortal';
import { useWorkflowStore } from '../../store/useWorkflowStore';
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
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AlertCircle } from 'lucide-react';

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
    handleArchiveWorkspace,
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
    } else if (pathname === '/admin/users') {
      setCurrentTab('users');
      setIsStudioOpen(false);
      setEditingTemplateId(null);
    } else if (pathname === '/admin/workspaces') {
      setCurrentTab('workspaces');
      setIsStudioOpen(false);
      setEditingTemplateId(null);
    } else if (pathname === '/admin/audit') {
      setCurrentTab('audit');
      setIsStudioOpen(false);
      setEditingTemplateId(null);
    } else if (pathname === '/admin' || pathname === '/admin/') {
      setCurrentTab('overview');
      setIsStudioOpen(false);
      setEditingTemplateId(null);
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wpe_template_updated'));
    }
  };

  const handleTabChange = (tab: typeof currentTab) => {
    setCurrentTab(tab);
    if (tab === 'templates') {
      navigate('/admin/templates');
    } else if (tab === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tab}`);
    }
  };

  const handleGlobalSearch = (term: string) => {
    setCurrentTab('users');
    setSearchQuery(term);
  };

  const logout = useWorkflowStore((state) => state.auth.logout);

  const handleLogout = async () => {
    await logout();
    showToast('Đã đăng xuất thành công.');
    navigate('/auth?tab=signin');
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 14, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ willChange: 'transform, opacity' }}
            >
              <ErrorBoundary>
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
                    onArchive={handleArchiveWorkspace}
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
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
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
        <ErrorBoundary
          fallback={(error, reset) => (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-4 shadow-sm">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Không thể mở Template Studio</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Đã xảy ra sự cố khi tải giao diện Studio.
                {error?.message ? ` (${error.message})` : ''}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={handleCloseStudio}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 cursor-pointer"
                >
                  Quay lại Danh sách Template
                </button>
              </div>
            </div>
          )}
        >
          <TemplateStudioView
            templateId={editingTemplateId}
            onClose={handleCloseStudio}
            onToast={(msg, tone) => showToast(msg, tone || 'blue')}
          />
        </ErrorBoundary>
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
