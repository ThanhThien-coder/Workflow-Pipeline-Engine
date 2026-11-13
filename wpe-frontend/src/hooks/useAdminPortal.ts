import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminService } from '../services/container';
import type { IAdminService } from '../services/admin/IAdminService';
import type {
  AdminUserDto,
  SuspendUserRequestDto,
  SystemKpiDto,
  AnalyticsTrendPointDto,
  RoleDistributionDto,
  WorkspaceOverviewDto,
  SecurityAuditLogDto,
  AuditLogGroup,
  AdminTabId,
} from '../types/admin.types';

export interface AdminToastItem {
  id: string;
  message: string;
  tone: 'blue' | 'rose' | 'emerald';
}

export type AdminPortalTab = 'overview' | 'users' | 'workspaces' | 'audit' | 'templates';

export function useAdminPortal(service: IAdminService = adminService) {
  const [currentTab, setCurrentTabState] = useState<AdminPortalTab>('overview');
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [kpis, setKpis] = useState<SystemKpiDto | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrendPointDto[]>([]);
  const [trendRange, setTrendRangeState] = useState<'7D' | '30D'>('7D');
  const [roleDistribution, setRoleDistribution] = useState<RoleDistributionDto | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOverviewDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLogDto[]>([]);
  const [auditGroup, setAuditGroupState] = useState<AuditLogGroup | 'ALL'>('ALL');
  const [loadErrors, setLoadErrors] = useState<Partial<Record<'overview' | 'users' | 'workspaces' | 'audit', string>>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modal Ban/Suspend State
  const [isBanModalOpen, setIsBanModalOpen] = useState<boolean>(false);
  const [selectedUserToBan, setSelectedUserToBan] = useState<AdminUserDto | null>(null);
  const [banReason, setBanReason] = useState<SuspendUserRequestDto['reason']>('TERMS_VIOLATION');

  // Toast Notifications
  const [toasts, setToasts] = useState<AdminToastItem[]>([]);

  const showToast = useCallback((message: string, tone: 'blue' | 'rose' | 'emerald' = 'blue') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Map any aliases to standard tab keys
  const setCurrentTab = useCallback((tab: AdminTabId) => {
    if (tab === 'analytics') {
      setCurrentTabState('overview');
    } else if (tab === 'logs') {
      setCurrentTabState('audit');
    } else {
      setCurrentTabState(tab as AdminPortalTab);
    }
  }, []);

  // Fetch initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiRes, trendsRes, rolesRes, usersRes, wsRes, logsRes] = await Promise.allSettled([
        service.getSystemKpis(),
        service.getAnalyticsTrends(trendRange),
        service.getRoleDistribution(),
        service.getUsers(),
        service.getWorkspaces(),
        service.getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup),
      ]);

      const errors: Partial<Record<'overview' | 'users' | 'workspaces' | 'audit', string>> = {};

      if (kpiRes.status === 'fulfilled') {
        setKpis(kpiRes.value);
      } else {
        setKpis(null);
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value);
      } else {
        setTrends([]);
      }

      if (rolesRes.status === 'fulfilled') {
        setRoleDistribution(rolesRes.value);
      } else {
        setRoleDistribution(null);
      }

      // lỗi của kpi/trend/role gộp vào overview
      if (kpiRes.status === 'rejected') {
        errors.overview = kpiRes.reason instanceof Error ? kpiRes.reason.message : String(kpiRes.reason);
      } else if (trendsRes.status === 'rejected') {
        errors.overview = trendsRes.reason instanceof Error ? trendsRes.reason.message : String(trendsRes.reason);
      } else if (rolesRes.status === 'rejected') {
        errors.overview = rolesRes.reason instanceof Error ? rolesRes.reason.message : String(rolesRes.reason);
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value);
      } else {
        setUsers([]);
        errors.users = usersRes.reason instanceof Error ? usersRes.reason.message : String(usersRes.reason);
        showToast('Không thể tải dữ liệu quản trị', 'rose');
      }

      if (wsRes.status === 'fulfilled') {
        setWorkspaces(wsRes.value);
      } else {
        setWorkspaces([]);
        errors.workspaces = wsRes.reason instanceof Error ? wsRes.reason.message : String(wsRes.reason);
      }

      if (logsRes.status === 'fulfilled') {
        setAuditLogs(logsRes.value);
      } else {
        setAuditLogs([]);
        errors.audit = logsRes.reason instanceof Error ? logsRes.reason.message : String(logsRes.reason);
      }

      setLoadErrors(errors);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [service, trendRange, showToast, auditGroup]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setAuditGroup = useCallback(
    async (group: AuditLogGroup | 'ALL') => {
      setAuditGroupState(group);
      try {
        const logs = await service.getSecurityAuditLogs(group === 'ALL' ? undefined : group);
        setAuditLogs(logs);
        setLoadErrors((prev) => {
          const next = { ...prev };
          delete next.audit;
          return next;
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setLoadErrors((prev) => ({ ...prev, audit: message }));
      }
    },
    [service]
  );

  // Range switch for Analytics Chart
  const handleTrendRangeChange = useCallback(
    async (range: '7D' | '30D') => {
      setTrendRangeState(range);
      try {
        const trendData = await service.getAnalyticsTrends(range);
        setTrends(trendData);
      } catch (err) {
        console.error('Failed to update trend range:', err);
      }
    },
    [service]
  );

  // Modal actions
  const openBanModal = useCallback((user: AdminUserDto) => {
    setSelectedUserToBan(user);
    setBanReason('TERMS_VIOLATION');
    setIsBanModalOpen(true);
  }, []);

  const closeBanModal = useCallback(() => {
    setIsBanModalOpen(false);
    setSelectedUserToBan(null);
  }, []);

  // Suspend user
  const handleSuspendUser = useCallback(
    async (userId: string, reason?: SuspendUserRequestDto['reason']) => {
      try {
        const effectiveReason = reason || banReason;
        const updated = await service.suspendUser({ userId, reason: effectiveReason });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        closeBanModal();
        showToast(`Đã khóa tài khoản ${updated.name} thành công`, 'rose');

        // Refresh audit logs in background
        service.getSecurityAuditLogs().then(setAuditLogs).catch(() => {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi khóa tài khoản';
        showToast(message, 'rose');
      }
    },
    [service, banReason, closeBanModal, showToast]
  );

  // Unban user
  const handleUnbanUser = useCallback(
    async (userId: string) => {
      try {
        const updated = await service.unbanUser(userId);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        showToast(`Đã mở khóa tài khoản ${updated.name} thành công`, 'emerald');

        // Refresh audit logs in background
        service.getSecurityAuditLogs().then(setAuditLogs).catch(() => {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi mở khóa tài khoản';
        showToast(message, 'rose');
      }
    },
    [service, showToast]
  );

  // Refresh pipelines/workspaces
  const handleRefreshWorkspaces = useCallback(async () => {
    try {
      const fresh = await service.getWorkspaces();
      setWorkspaces(fresh);
      showToast('Pipeline status đã được cập nhật', 'emerald');
    } catch {
      showToast('Lỗi làm mới danh sách workspaces', 'rose');
    }
  }, [service, showToast]);

  // Archive workspace
  const handleArchiveWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const updated = await service.archiveWorkspace(workspaceId);
      setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      showToast(`Đã lưu trữ dự án "${updated.name}" thành công (ARCHIVED)`, 'emerald');
      service.getSecurityAuditLogs().then(setAuditLogs).catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi lưu trữ dự án';
      showToast(message, 'rose');
    }
  }, [service, showToast]);

  // Filtered users for UserManagementTab
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchStatus = statusFilter === 'ALL' || user.status === statusFilter;
      const matchQuery =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.username.toLowerCase().includes(q) ||
        user.id.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [users, searchQuery, statusFilter]);

  return {
    currentTab,
    setCurrentTab,
    users,
    filteredUsers,
    kpis,
    trends,
    trendRange,
    handleTrendRangeChange,
    roleDistribution,
    workspaces,
    auditLogs,
    auditGroup,
    setAuditGroup,
    loadErrors,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    // Ban modal
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
    // Toasts
    toasts,
    showToast,
    dismissToast,
    loadData,
  };
}
