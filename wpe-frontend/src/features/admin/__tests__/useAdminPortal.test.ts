// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminPortal } from '../../../hooks/useAdminPortal';
import type { IAdminService } from '../../../services/admin/IAdminService';
import type { AdminUserDto, AdminWorkspaceDto, AdminWorkspaceDetailDto } from '../../../types/admin.types';

describe('useAdminPortal hook', () => {
  it('service có getStats lỗi mà getUsers thành công -> users vẫn có dữ liệu và loadErrors.overview có giá trị', async () => {
    const mockUsers: AdminUserDto[] = [
      {
        id: '1',
        name: 'Alex Kim',
        username: 'alex.kim',
        maskedEmail: 'a***@pipeline.engine',
        role: 'ADMIN',
        status: 'ACTIVE',
        ownedProjectCount: 2,
        joinedProjectCount: 3,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ];

    const mockService: IAdminService = {
      getStats: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getTrends: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getUsers: vi.fn().mockResolvedValue(mockUsers),
      getWorkspaces: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getWorkspaceDetail: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getSecurityAuditLogs: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
      changeUserRole: vi.fn(),
      deleteUser: vi.fn(),
      getOwnedProjects: vi.fn().mockResolvedValue([]),
      transferProjectOwner: vi.fn(),
    };

    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].name).toBe('Alex Kim');
    expect(result.current.loadErrors.overview).toBe('Chưa nối API');
    expect(result.current.loadErrors.workspaces).toBe('Chưa nối API');
    expect(result.current.loadErrors.users).toBeUndefined();
  });

  it('filteredUsers không tìm theo maskedEmail: tìm theo email rỗng, tìm theo tên ra 1 user', async () => {
    const mockUsers: AdminUserDto[] = [
      {
        id: '1',
        name: 'Alex Kim',
        username: 'alex.kim',
        maskedEmail: 'a***@pipeline.engine',
        role: 'ADMIN',
        status: 'ACTIVE',
        ownedProjectCount: 2,
        joinedProjectCount: 3,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ];

    const mockService: IAdminService = {
      getStats: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getTrends: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getUsers: vi.fn().mockResolvedValue(mockUsers),
      getWorkspaces: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getWorkspaceDetail: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getSecurityAuditLogs: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
      changeUserRole: vi.fn(),
      deleteUser: vi.fn(),
      getOwnedProjects: vi.fn().mockResolvedValue([]),
      transferProjectOwner: vi.fn(),
    };

    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filteredUsers).toHaveLength(1);

    act(() => {
      result.current.setSearchQuery('pipeline.engine');
    });
    expect(result.current.filteredUsers).toHaveLength(0);

    act(() => {
      result.current.setSearchQuery('alex');
    });
    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Alex Kim');
  });

  it('handleDeleteUser thành công bỏ user khỏi users; service ném lỗi thì users giữ nguyên và trả false', async () => {
    const mockUsers: AdminUserDto[] = [
      {
        id: '1',
        name: 'Alex Kim',
        username: 'alex.kim',
        maskedEmail: 'a***@pipeline.engine',
        role: 'ADMIN',
        status: 'ACTIVE',
        ownedProjectCount: 2,
        joinedProjectCount: 3,
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: '2',
        name: 'Bob Smith',
        username: 'bob.smith',
        maskedEmail: 'b***@pipeline.engine',
        role: 'STANDARD_USER',
        status: 'ACTIVE',
        ownedProjectCount: 0,
        joinedProjectCount: 0,
        createdAt: '2026-10-02T10:00:00Z',
      },
    ];

    const deleteUserMock = vi.fn().mockResolvedValue(undefined);

    const mockService: IAdminService = {
      getStats: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getTrends: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getUsers: vi.fn().mockResolvedValue(mockUsers),
      getWorkspaces: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getWorkspaceDetail: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getSecurityAuditLogs: vi.fn().mockResolvedValue([]),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
      changeUserRole: vi.fn(),
      deleteUser: deleteUserMock,
      getOwnedProjects: vi.fn().mockResolvedValue([]),
      transferProjectOwner: vi.fn(),
    };

    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(2);

    let success = false;
    await act(async () => {
      success = await result.current.handleDeleteUser('2');
    });

    expect(success).toBe(true);
    expect(deleteUserMock).toHaveBeenCalledWith('2');
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].id).toBe('1');

    deleteUserMock.mockRejectedValueOnce(new Error('Tài khoản đã có dữ liệu'));

    let failResult = true;
    await act(async () => {
      failResult = await result.current.handleDeleteUser('1');
    });

    expect(failResult).toBe(false);
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].id).toBe('1');
  });

  it('loadWorkspaceDetail thành công lưu workspaceDetail, thất bại toast lỗi và trả null', async () => {
    const mockDetail: AdminWorkspaceDetailDto = {
      id: 'ws_1',
      name: 'Project One',
      description: 'Desc',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
      owner: { ownerId: '1', ownerName: 'Alex', ownerMaskedEmail: 'a***@b.c' },
      membersByRole: { OWNER: 1, MANAGER: 0, COLLABORATOR: 1, VIEWER: 0 },
      pendingInvitationCount: 0,
      phaseCount: 2,
      nodeCount: 5,
      nodesByStatus: { LOCKED: 0, TODO: 2, IN_PROGRESS: 1, REVIEW: 1, DONE: 1 },
      progressPercentage: 20,
      overdueCount: 0,
      guestLinkActive: false,
      guestLinkExpiresAt: null,
      lastActivityAt: '2026-10-02T00:00:00Z',
      ownerCandidates: [],
    };

    const getWorkspaceDetailMock = vi.fn().mockResolvedValue(mockDetail);

    const mockService: IAdminService = {
      getStats: vi.fn().mockResolvedValue({
        users: { total: 1, active: 1, suspended: 0, newLast7Days: 1 },
        projects: { total: 1, byStatus: { ACTIVE: 1 }, newLast7Days: 1 },
        tasks: { total: 5, byStatus: {}, overdue: 0 },
        templates: { publicCount: 1, privateCount: 0, totalClones: 0 },
        roles: { systemRoles: {}, projectRoles: {} },
      }),
      getTrends: vi.fn().mockResolvedValue([]),
      getUsers: vi.fn().mockResolvedValue([]),
      getWorkspaces: vi.fn().mockResolvedValue([]),
      getWorkspaceDetail: getWorkspaceDetailMock,
      getSecurityAuditLogs: vi.fn().mockResolvedValue([]),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
      changeUserRole: vi.fn(),
      deleteUser: vi.fn(),
      getOwnedProjects: vi.fn().mockResolvedValue([]),
      transferProjectOwner: vi.fn(),
    };

    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loadedDetail: AdminWorkspaceDetailDto | null = null;
    await act(async () => {
      loadedDetail = await result.current.loadWorkspaceDetail('ws_1');
    });

    expect(loadedDetail).toEqual(mockDetail);
    expect(result.current.workspaceDetail).toEqual(mockDetail);

    getWorkspaceDetailMock.mockRejectedValueOnce(new Error('Không tìm thấy'));
    let failDetail: AdminWorkspaceDetailDto | null = null;
    await act(async () => {
      failDetail = await result.current.loadWorkspaceDetail('ws_unknown');
    });

    expect(failDetail).toBeNull();
    expect(result.current.workspaceDetail).toBeNull();
  });

  it('handleArchiveWorkspace thành công cập nhật trạng thái dòng và tải ngầm stats', async () => {
    const initialWorkspaces: AdminWorkspaceDto[] = [
      {
        id: 'ws_1',
        name: 'Project One',
        ownerId: '1',
        ownerName: 'Alex',
        ownerMaskedEmail: 'a***@b.c',
        status: 'ACTIVE',
        memberCount: 2,
        phaseCount: 1,
        nodeCount: 5,
        doneNodeCount: 2,
        progressPercentage: 40,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
      },
    ];

    const updatedWorkspace: AdminWorkspaceDto = {
      ...initialWorkspaces[0],
      status: 'ARCHIVED',
    };

    const archiveMock = vi.fn().mockResolvedValue(updatedWorkspace);
    const getStatsMock = vi.fn().mockResolvedValue({
      users: { total: 1, active: 1, suspended: 0, newLast7Days: 1 },
      projects: { total: 1, byStatus: { ARCHIVED: 1 }, newLast7Days: 0 },
      tasks: { total: 5, byStatus: {}, overdue: 0 },
      templates: { publicCount: 1, privateCount: 0, totalClones: 0 },
      roles: { systemRoles: {}, projectRoles: {} },
    });

    const mockService: IAdminService = {
      getStats: getStatsMock,
      getTrends: vi.fn().mockResolvedValue([]),
      getUsers: vi.fn().mockResolvedValue([]),
      getWorkspaces: vi.fn().mockResolvedValue(initialWorkspaces),
      getWorkspaceDetail: vi.fn(),
      getSecurityAuditLogs: vi.fn().mockResolvedValue([]),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: archiveMock,
      changeUserRole: vi.fn(),
      deleteUser: vi.fn(),
      getOwnedProjects: vi.fn().mockResolvedValue([]),
      transferProjectOwner: vi.fn(),
    };

    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.workspaces).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleArchiveWorkspace('ws_1');
    });

    expect(archiveMock).toHaveBeenCalledWith('ws_1');
    expect(result.current.workspaces[0].status).toBe('ARCHIVED');
  });
});
