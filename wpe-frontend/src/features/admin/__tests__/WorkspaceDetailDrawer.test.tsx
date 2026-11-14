// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorkspaceDetailDrawer } from '../components/WorkspaceDetailDrawer';
import type { AdminWorkspaceDetailDto } from '../../../types/admin.types';

describe('WorkspaceDetailDrawer Component', () => {
  const onClose = vi.fn();
  const onArchive = vi.fn();
  const onTransfer = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockDetailWithCandidates: AdminWorkspaceDetailDto = {
    id: '1',
    name: 'Dự án Thương mại điện tử',
    description: 'Hệ thống xử lý đơn hàng',
    status: 'ACTIVE',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    owner: {
      ownerId: '10',
      ownerName: 'Sarah Chen',
      ownerMaskedEmail: 's***@pipeline.engine',
    },
    membersByRole: {
      OWNER: 1,
      MANAGER: 1,
      COLLABORATOR: 2,
      VIEWER: 1,
    },
    pendingInvitationCount: 3,
    phaseCount: 4,
    nodeCount: 20,
    nodesByStatus: {
      LOCKED: 2,
      TODO: 5,
      IN_PROGRESS: 6,
      REVIEW: 2,
      DONE: 5,
    },
    progressPercentage: 25,
    overdueCount: 2,
    guestLinkActive: true,
    guestLinkExpiresAt: '2026-11-01T00:00:00Z',
    lastActivityAt: '2026-10-05T12:00:00Z',
    ownerCandidates: [
      { userId: '20', name: 'Alex Kim', username: 'alex.kim' },
      { userId: '30', name: 'Marcus Liu', username: 'marcus.liu' },
    ],
  };

  const mockDetailSolo: AdminWorkspaceDetailDto = {
    ...mockDetailWithCandidates,
    id: '2',
    name: 'Dự án Một Người',
    status: 'ACTIVE',
    ownerCandidates: [],
  };

  const mockDetailArchived: AdminWorkspaceDetailDto = {
    ...mockDetailWithCandidates,
    id: '3',
    name: 'Dự án Lưu Trữ',
    status: 'ARCHIVED',
    ownerCandidates: [
      { userId: '20', name: 'Alex Kim', username: 'alex.kim' },
    ],
  };

  const mockDetailCompleted: AdminWorkspaceDetailDto = {
    ...mockDetailWithCandidates,
    id: '4',
    name: 'Dự án Hoàn Thành',
    status: 'COMPLETED',
    ownerCandidates: [
      { userId: '20', name: 'Alex Kim', username: 'alex.kim' },
    ],
  };

  it('hiện đủ 4 tiêu đề nhóm và không có chữ "token"', () => {
    const { container } = render(
      <WorkspaceDetailDrawer
        projectId="1"
        detail={mockDetailWithCandidates}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    // 1. Hiện đủ 4 tiêu đề nhóm
    expect(screen.getByText('Tổng quan')).toBeTruthy();
    expect(screen.getByText('Thành viên')).toBeTruthy();
    expect(screen.getByText('Tiến độ')).toBeTruthy();
    expect(screen.getByText('Chia sẻ')).toBeTruthy();

    // 2. Không có chữ "token" trong DOM
    const textContent = container.textContent || '';
    expect(textContent.toLowerCase()).not.toContain('token');
  });

  it('ownerCandidates rỗng hiện câu "Dự án chỉ có một người, không chuyển được. Chỉ có thể lưu trữ."', () => {
    render(
      <WorkspaceDetailDrawer
        projectId="2"
        detail={mockDetailSolo}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    expect(
      screen.getByText('Dự án chỉ có một người, không chuyển được. Chỉ có thể lưu trữ.')
    ).toBeTruthy();
  });

  it('khi trạng thái là ARCHIVED thì ẩn nút Lưu trữ dự án', () => {
    render(
      <WorkspaceDetailDrawer
        projectId="3"
        detail={mockDetailArchived}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    expect(screen.queryByText('Lưu trữ dự án')).toBeNull();
  });

  it('dự án ARCHIVED không hiện select/nút chuyển chủ mà hiện câu "Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được."', () => {
    render(
      <WorkspaceDetailDrawer
        projectId="3"
        detail={mockDetailArchived}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    expect(
      screen.getByText('Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được.')
    ).toBeTruthy();
    expect(screen.queryByLabelText('Chủ mới')).toBeNull();
    expect(screen.queryByText('Chuyển')).toBeNull();
  });

  it('dự án COMPLETED không hiện select/nút chuyển chủ mà hiện câu "Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được."', () => {
    render(
      <WorkspaceDetailDrawer
        projectId="4"
        detail={mockDetailCompleted}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    expect(
      screen.getByText('Dự án đã lưu trữ hoặc đã hoàn thành, không chuyển chủ được.')
    ).toBeTruthy();
    expect(screen.queryByLabelText('Chủ mới')).toBeNull();
    expect(screen.queryByText('Chuyển')).toBeNull();
  });

  it('chọn chủ mới và bấm Chuyển gọi onTransfer(projectId, newOwnerId)', async () => {
    render(
      <WorkspaceDetailDrawer
        projectId="1"
        detail={mockDetailWithCandidates}
        loading={false}
        onClose={onClose}
        onArchive={onArchive}
        onTransfer={onTransfer}
      />
    );

    const select = screen.getByLabelText('Chủ mới');
    fireEvent.change(select, { target: { value: '20' } });

    const transferBtn = screen.getByText('Chuyển');
    fireEvent.click(transferBtn);

    expect(onTransfer).toHaveBeenCalledWith('1', '20');
  });
});
