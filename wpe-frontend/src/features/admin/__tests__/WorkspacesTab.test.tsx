// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { WorkspacesTab } from '../tabs/WorkspacesTab';
import type { AdminWorkspaceDto } from '../../../types/admin.types';

describe('WorkspacesTab Component', () => {
  const onRefresh = vi.fn();
  const onOpenDetail = vi.fn();
  const onArchive = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockWorkspaces: AdminWorkspaceDto[] = [
    {
      id: '1',
      name: 'Project Alpha',
      ownerId: '10',
      ownerName: 'Sarah Chen',
      ownerMaskedEmail: 's***@pipeline.engine',
      status: 'ACTIVE',
      memberCount: 4,
      phaseCount: 3,
      nodeCount: 10,
      doneNodeCount: 6,
      progressPercentage: 60,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
    },
    {
      id: '2',
      name: 'Project Beta',
      ownerId: '20',
      ownerName: 'Alex Kim',
      ownerMaskedEmail: 'a***@pipeline.engine',
      status: 'ARCHIVED',
      memberCount: 2,
      phaseCount: 1,
      nodeCount: 5,
      doneNodeCount: 5,
      progressPercentage: 100,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-15T12:00:00Z',
    },
  ];

  it('hiện tên chủ + email đã che + %; bấm "Xem chi tiết" gọi onOpenDetail("1"); dự án ARCHIVED không có nút "Lưu trữ"', () => {
    render(
      <WorkspacesTab
        workspaces={mockWorkspaces}
        onRefresh={onRefresh}
        onOpenDetail={onOpenDetail}
        onArchive={onArchive}
      />
    );

    // 1. Kiểm tra hiện tên chủ + email đã che + %
    expect(screen.getByText('Sarah Chen')).toBeTruthy();
    expect(screen.getByText('s***@pipeline.engine')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();

    // 2. Bấm "Xem chi tiết" dòng 1 gọi onOpenDetail('1')
    const row1 = screen.getByText('Project Alpha').closest('tr')!;
    const viewDetailBtn = within(row1).getByText('Xem chi tiết');
    fireEvent.click(viewDetailBtn);
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith('1');

    // 3. Dòng 1 (ACTIVE) có nút "Lưu trữ"
    expect(within(row1).getByRole('button', { name: 'Lưu trữ' })).toBeTruthy();

    // 4. Dòng 2 (ARCHIVED) KHÔNG có nút "Lưu trữ"
    const row2 = screen.getByText('Project Beta').closest('tr')!;
    expect(within(row2).queryByRole('button', { name: 'Lưu trữ' })).toBeNull();
  });

  it('danh sách rỗng hiện thông báo "Chưa có dự án nào"', () => {
    render(
      <WorkspacesTab
        workspaces={[]}
        onRefresh={onRefresh}
        onOpenDetail={onOpenDetail}
        onArchive={onArchive}
      />
    );

    expect(screen.getByText('Chưa có dự án nào')).toBeTruthy();
  });

  it('có errorMessage hiện khung lỗi và không hiện bảng', () => {
    render(
      <WorkspacesTab
        workspaces={mockWorkspaces}
        onRefresh={onRefresh}
        onOpenDetail={onOpenDetail}
        onArchive={onArchive}
        errorMessage="Không thể kết nối máy chủ"
      />
    );

    expect(screen.getByText(/Chưa có dữ liệu: Không thể kết nối máy chủ/)).toBeTruthy();
    expect(screen.queryByText('Project Alpha')).toBeNull();
  });
});
