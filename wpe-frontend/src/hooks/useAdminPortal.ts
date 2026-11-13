import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminService } from '../services/container';
import type { IAdminService } from '../services/admin/IAdminService';
import type {
  AdminUserDto,
  SuspendUserRequestDto,
  AdminStatsDto,
  AdminTrendPointDto,
  AdminWorkspaceDto,
  AdminWorkspaceDetailDto,
  SecurityAuditLogDto,
  AuditLogGroup,
  AdminTabId,
  OwnedProjectDto,
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
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [trends, setTrends] = useState<AdminTrendPointDto[]>([]);
  const [trendRange, setTrendRangeState] = useState<'7D' | '30D'>('7D');
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceDto[]>([]);
  const [workspaceDetail, setWorkspaceDetail] = useState<AdminWorkspaceDetailDto | null>(null);
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
      const [statsRes, trendsRes, usersRes, wsRes, logsRes] = await Promise.allSettled([
        service.getStats(),
        service.getTrends(trendRange),
        service.getUsers(),
        service.getWorkspaces(),
        service.getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup),
      ]);

      const errors: Partial<Record<'overview' | 'users' | 'workspaces' | 'audit', string>> = {};

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats(null);
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value);
      } else {
        setTrends([]);
      }

      // lỗi của stats hoặc trends gộp vào overview
      if (statsRes.status === 'rejected') {
        errors.overview = statsRes.reason instanceof Error ? statsRes.reason.message : String(statsRes.reason);
      } else if (trendsRes.status === 'rejected') {
        errors.overview = trendsRes.reason instanceof Error ? trendsRes.reason.message : String(trendsRes.reason);
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

  // Range switch for Trends
  const handleTrendRangeChange = useCallback(
    async (range: '7D' | '30D') => {
      setTrendRangeState(range);
      try {
        const trendData = await service.getTrends(range);
        setTrends(trendData);
      } catch (err) {
        console.error('Failed to update trend range:', err);
      }
    },
    [service]
  );

  // Workspace detail
  const loadWorkspaceDetail = useCallback(
    async (id: string): Promise<AdminWorkspaceDetailDto | null> => {
      try {
        const detail = await service.getWorkspaceDetail(id);
        setWorkspaceDetail(detail);
        return detail;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi tải chi tiết dự án';
        showToast(message, 'rose');
        setWorkspaceDetail(null);
        return null;
      }
    },
    [service, showToast]
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
        service.getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup).then(setAuditLogs).catch(() => {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi khóa tài khoản';
        showToast(message, 'rose');
      }
    },
    [service, banReason, closeBanModal, showToast, auditGroup]
  );

  // Unban user
  const handleUnbanUser = useCallback(
    async (userId: string) => {
      try {
        const updated = await service.unbanUser(userId);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        showToast(`Đã mở khóa tài khoản ${updated.name} thành công`, 'emerald');

        // Refresh audit logs in background
        service.getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup).then(setAuditLogs).catch(() => {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi mở khóa tài khoản';
        showToast(message, 'rose');
      }
    },
    [service, showToast, auditGroup]
  );

  // Change user role
  const handleChangeRole = useCallback(
    async (userId: string, role: 'ADMIN' | 'USER'): Promise<boolean> => {
      try {
        const updated = await service.changeUserRole(userId, role);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        const name = updated.name || users.find((u) => u.id === userId)?.name || '';
        const roleLabel = role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng';
        showToast(`Đã đổi vai trò của ${name} thành ${roleLabel}`, 'emerald');
        service
          .getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup)
          .then(setAuditLogs)
          .catch(() => {});
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi đổi vai trò';
        showToast(message, 'rose');
        return false;
      }
    },
    [service, auditGroup, showToast, users]
  );

  // Delete user
  const handleDeleteUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await service.deleteUser(userId);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showToast('Đã xóa tài khoản', 'emerald');
        service
          .getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup)
          .then(setAuditLogs)
          .catch(() => {});
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi xóa tài khoản';
        showToast(message, 'rose');
        return false;
      }
    },
    [service, auditGroup, showToast]
  );

  // Load owned projects
  const loadOwnedProjects = useCallback(
    async (userId: string): Promise<OwnedProjectDto[]> => {
      try {
        return await service.getOwnedProjects(userId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi tải danh sách dự án sở hữu';
        showToast(message, 'rose');
        return [];
      }
    },
    [service, showToast]
  );

  // Transfer project owner
  const handleTransferOwner = useCallback(
    async (projectId: string, newOwnerId: string): Promise<OwnedProjectDto | null> => {
      try {
        const updated = await service.transferProjectOwner(projectId, newOwnerId);
        showToast('Đã chuyển chủ dự án', 'emerald');
        try {
          const freshUsers = await service.getUsers();
          setUsers(freshUsers);
        } catch {
          // ignore error fetching users
        }
        try {
          const freshWorkspaces = await service.getWorkspaces();
          setWorkspaces(freshWorkspaces);
        } catch {
          // ignore error fetching workspaces
        }
        service
          .getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup)
          .then(setAuditLogs)
          .catch(() => {});
        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi khi chuyển chủ dự án';
        showToast(message, 'rose');
        return null;
      }
    },
    [service, auditGroup, showToast]
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
      setWorkspaceDetail((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status } : prev));
      showToast(`Đã lưu trữ dự án "${updated.name}" thành công (ARCHIVED)`, 'emerald');
      // tải lại stats ngầm và nhật ký ngầm
      service.getStats().then(setStats).catch(() => {});
      service.getSecurityAuditLogs(auditGroup === 'ALL' ? undefined : auditGroup).then(setAuditLogs).catch(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi lưu trữ dự án';
      showToast(message, 'rose');
    }
  }, [service, auditGroup, showToast]);

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
    stats,
    trends,
    trendRange,
    handleTrendRangeChange,
    workspaces,
    workspaceDetail,
    loadWorkspaceDetail,
    setWorkspaceDetail,
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
    handleChangeRole,
    handleDeleteUser,
    loadOwnedProjects,
    handleTransferOwner,
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
