// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAdminPortal } from '../../../hooks/useAdminPortal';
import type { IAdminService } from '../../../services/admin/IAdminService';
import type { AdminUserDto } from '../../../types/admin.types';

describe('useAdminPortal hook', () => {
  it('service có getSystemKpis lỗi mà getUsers thành công -> users vẫn có dữ liệu và loadErrors.overview có giá trị', async () => {
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
      getSystemKpis: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getAnalyticsTrends: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getRoleDistribution: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getUsers: vi.fn().mockResolvedValue(mockUsers),
      getWorkspaces: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getSecurityAuditLogs: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
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
      getSystemKpis: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getAnalyticsTrends: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getRoleDistribution: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getUsers: vi.fn().mockResolvedValue(mockUsers),
      getWorkspaces: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      getSecurityAuditLogs: vi.fn().mockRejectedValue(new Error('Chưa nối API')),
      suspendUser: vi.fn(),
      unbanUser: vi.fn(),
      archiveWorkspace: vi.fn(),
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
});
