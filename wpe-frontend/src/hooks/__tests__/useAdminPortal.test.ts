// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminPortal } from '../useAdminPortal';
import { MockAdminService } from '../../services/admin/MockAdminService';

describe('useAdminPortal Hook DI & Business Logic Tests', () => {
  let mockService: MockAdminService;

  beforeEach(() => {
    mockService = new MockAdminService();
  });

  it('should initialize data from injected service', async () => {
    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentTab).toBe('overview');
    expect(result.current.stats?.users.total).toBe(6);
    expect(result.current.users.length).toBeGreaterThan(0);
    expect(result.current.trends.length).toBe(7);
  });

  it('should switch tabs seamlessly', async () => {
    const { result } = renderHook(() => useAdminPortal(mockService));

    act(() => {
      result.current.setCurrentTab('users');
    });
    expect(result.current.currentTab).toBe('users');

    act(() => {
      result.current.setCurrentTab('analytics');
    });
    expect(result.current.currentTab).toBe('overview');

    act(() => {
      result.current.setCurrentTab('logs');
    });
    expect(result.current.currentTab).toBe('audit');
  });

  it('should filter users by search query and status', async () => {
    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Filter by query
    act(() => {
      result.current.setSearchQuery('sarah');
    });
    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Sarah Chen');

    // Filter by status SUSPENDED
    act(() => {
      result.current.setSearchQuery('');
      result.current.setStatusFilter('SUSPENDED');
    });
    expect(result.current.filteredUsers.every((u) => u.status === 'SUSPENDED')).toBe(true);
  });

  it('should handle suspending and unbanning users with toast notifications', async () => {
    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const userToSuspend = result.current.users.find((u) => u.id === 'usr_04DV88')!;

    // Open ban modal
    act(() => {
      result.current.openBanModal(userToSuspend);
    });
    expect(result.current.isBanModalOpen).toBe(true);
    expect(result.current.selectedUserToBan?.id).toBe('usr_04DV88');

    // Suspend user
    await act(async () => {
      await result.current.handleSuspendUser('usr_04DV88', 'SECURITY_RISK');
    });

    expect(result.current.isBanModalOpen).toBe(false);
    const updated = result.current.users.find((u) => u.id === 'usr_04DV88');
    expect(updated?.status).toBe('SUSPENDED');
    expect(result.current.toasts.length).toBeGreaterThan(0);
    expect(result.current.toasts[result.current.toasts.length - 1].tone).toBe('rose');

    // Unban user
    await act(async () => {
      await result.current.handleUnbanUser('usr_04DV88');
    });
    const unbanned = result.current.users.find((u) => u.id === 'usr_04DV88');
    expect(unbanned?.status).toBe('ACTIVE');
    expect(result.current.toasts[result.current.toasts.length - 1].tone).toBe('emerald');
  });

  it('should switch trend range and update trends', async () => {
    const { result } = renderHook(() => useAdminPortal(mockService));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleTrendRangeChange('30D');
    });

    expect(result.current.trendRange).toBe('30D');
    expect(result.current.trends).toHaveLength(30);
    expect(result.current.trends[0].date).toBeDefined();
  });
});
