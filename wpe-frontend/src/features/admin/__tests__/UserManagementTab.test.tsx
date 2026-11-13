// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { UserManagementTab } from '../tabs/UserManagementTab';
import type { AdminUserDto } from '../../../types/admin.types';

describe('UserManagementTab Component', () => {
  const onSearchChange = vi.fn();
  const onStatusFilterChange = vi.fn();
  const onOpenBanModal = vi.fn();
  const onUnban = vi.fn();
  const onChangeRole = vi.fn().mockResolvedValue(true);
  const onDeleteUser = vi.fn().mockResolvedValue(true);
  const onOpenOwnedProjects = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockUsers: AdminUserDto[] = [
    {
      id: '1',
      name: 'Current Admin',
      username: 'admin.current',
      maskedEmail: 'cur***@pipeline.engine',
      role: 'ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 2,
      joinedProjectCount: 1,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: '2',
      name: 'Other Admin',
      username: 'admin.other',
      maskedEmail: 'oth***@pipeline.engine',
      role: 'ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 0,
      joinedProjectCount: 1,
      createdAt: '2026-10-02T10:00:00Z',
    },
    {
      id: '3',
      name: 'Standard User',
      username: 'user.standard',
      maskedEmail: 'std***@pipeline.engine',
      role: 'STANDARD_USER',
      status: 'ACTIVE',
      ownedProjectCount: 0,
      joinedProjectCount: 0,
      createdAt: '2026-10-03T10:00:00Z',
    },
    {
      id: '4',
      name: 'Owner User',
      username: 'user.owner',
      maskedEmail: 'own***@pipeline.engine',
      role: 'STANDARD_USER',
      status: 'ACTIVE',
      ownedProjectCount: 3,
      joinedProjectCount: 0,
      createdAt: '2026-10-04T10:00:00Z',
    },
  ];

  it('dòng của chính mình không có "Hạ về người dùng" và "Xóa"; user thường có "Nâng quản trị"; ownedProjectCount = 0 không có "Dự án sở hữu"', () => {
    render(
      <UserManagementTab
        users={mockUsers}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="ALL"
        onStatusFilterChange={onStatusFilterChange}
        onOpenBanModal={onOpenBanModal}
        onUnban={onUnban}
        currentUserId="1"
        onChangeRole={onChangeRole}
        onDeleteUser={onDeleteUser}
        onOpenOwnedProjects={onOpenOwnedProjects}
      />
    );

    // 1. Dòng của chính mình (id: '1', Current Admin):
    const currentRow = screen.getByText('Current Admin').closest('tr')!;
    expect(currentRow).toBeTruthy();
    expect(within(currentRow).queryByText('Hạ về người dùng')).toBeNull();
    expect(within(currentRow).queryByText('Xóa')).toBeNull();
    expect(within(currentRow).queryByText('Suspend')).toBeNull();
    // Vì ownedProjectCount = 2 > 0 nên có nút "Dự án sở hữu"
    expect(within(currentRow).getByText('Dự án sở hữu')).toBeTruthy();

    // 2. Dòng của admin khác (id: '2', Other Admin):
    const otherAdminRow = screen.getByText('Other Admin').closest('tr')!;
    expect(otherAdminRow).toBeTruthy();
    expect(within(otherAdminRow).getByText('Hạ về người dùng')).toBeTruthy();
    expect(within(otherAdminRow).queryByText('Xóa')).toBeNull();
    // ownedProjectCount = 0 không có "Dự án sở hữu"
    expect(within(otherAdminRow).queryByText('Dự án sở hữu')).toBeNull();

    // 3. User thường (id: '3', Standard User):
    const standardRow = screen.getByText('Standard User').closest('tr')!;
    expect(standardRow).toBeTruthy();
    expect(within(standardRow).getByText('Nâng quản trị')).toBeTruthy();
    expect(within(standardRow).getByText('Xóa')).toBeTruthy();
    // ownedProjectCount = 0 không có "Dự án sở hữu"
    expect(within(standardRow).queryByText('Dự án sở hữu')).toBeNull();

    // 4. User thường có sở hữu dự án (id: '4', Owner User):
    const ownerRow = screen.getByText('Owner User').closest('tr')!;
    expect(ownerRow).toBeTruthy();
    expect(within(ownerRow).getByText('Dự án sở hữu')).toBeTruthy();
  });

  it('bấm "Xóa" mở modal, bấm xác nhận gọi onDeleteUser(id)', async () => {
    render(
      <UserManagementTab
        users={mockUsers}
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="ALL"
        onStatusFilterChange={onStatusFilterChange}
        onOpenBanModal={onOpenBanModal}
        onUnban={onUnban}
        currentUserId="1"
        onChangeRole={onChangeRole}
        onDeleteUser={onDeleteUser}
        onOpenOwnedProjects={onOpenOwnedProjects}
      />
    );

    const standardRow = screen.getByText('Standard User').closest('tr')!;
    const deleteBtn = within(standardRow).getByText('Xóa');
    fireEvent.click(deleteBtn);

    // Modal xuất hiện
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(
      within(dialog).getByText(/Xóa vĩnh viễn tài khoản Standard User\? Chỉ xóa được tài khoản chưa có dữ liệu\./)
    ).toBeTruthy();

    // Bấm nút xác nhận trong modal
    const confirmBtn = within(dialog).getByText('Xác nhận');
    fireEvent.click(confirmBtn);

    expect(onDeleteUser).toHaveBeenCalledTimes(1);
    expect(onDeleteUser).toHaveBeenCalledWith('3');
  });
});
