import type { FC } from 'react';
import { useAdminPortal } from '../../hooks/useAdminPortal';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminTopbar } from './components/AdminTopbar';
import { BanConfirmModal } from './components/BanConfirmModal';
import { AdminToast } from './components/AdminToast';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { UserManagementTab } from './tabs/UserManagementTab';
import { WorkspacesTab } from './tabs/WorkspacesTab';
import { AuditLogsTab } from './tabs/AuditLogsTab';

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

  const handleGlobalSearch = (term: string) => {
    setCurrentTab('users');
    setSearchQuery(term);
  };

  const handleNotificationClick = () => {
    showToast('Không có cảnh báo mới. Hệ thống đang ổn định.', 'emerald');
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
        onTabChange={setCurrentTab}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Viewport */}
      <main className="min-w-0 flex-1 h-screen overflow-y-auto">
        {/* Top Header */}
        <AdminTopbar
          currentTab={currentTab}
          onGlobalSearch={handleGlobalSearch}
          onNotificationClick={handleNotificationClick}
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
