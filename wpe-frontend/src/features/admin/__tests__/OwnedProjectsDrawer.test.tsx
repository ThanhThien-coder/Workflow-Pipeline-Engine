// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OwnedProjectsDrawer } from '../components/OwnedProjectsDrawer';
import type { AdminUserDto, OwnedProjectDto } from '../../../types/admin.types';

describe('OwnedProjectsDrawer Component', () => {
  const onClose = vi.fn();
  const loadOwnedProjects = vi.fn();
  const onTransfer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockUser: AdminUserDto = {
    id: 'user_1',
    name: 'Alex Kim',
    username: 'alex.kim',
    maskedEmail: 'al***@pipeline.engine',
    role: 'STANDARD_USER',
    status: 'ACTIVE',
    ownedProjectCount: 2,
    joinedProjectCount: 0,
    createdAt: '2026-10-01T10:00:00Z',
  };

  const mockProjects: OwnedProjectDto[] = [
    {
      projectId: '1',
      name: 'Project One',
      status: 'RUNNING',
      memberCount: 2,
      candidates: [{ userId: '3', name: 'Charlie', username: 'charlie' }],
    },
    {
      projectId: '2',
      name: 'Solo Project',
      status: 'IDLE',
      memberCount: 1,
      candidates: [],
    },
  ];

  it('dự án candidates rỗng hiện "Dự án chỉ có một người"; chọn chủ mới rồi bấm "Chuyển chủ" gọi onTransfer(\'1\', \'3\') và dự án biến khỏi danh sách', async () => {
    loadOwnedProjects.mockResolvedValue(mockProjects);
    onTransfer.mockResolvedValue({
      projectId: '1',
      name: 'Project One',
      status: 'RUNNING',
      memberCount: 2,
      candidates: [],
    });

    render(
      <OwnedProjectsDrawer
        user={mockUser}
        onClose={onClose}
        loadOwnedProjects={loadOwnedProjects}
        onTransfer={onTransfer}
      />
    );

    // Đợi tải xong danh sách dự án
    expect(await screen.findByText('Project One')).toBeTruthy();
    expect(await screen.findByText('Solo Project')).toBeTruthy();

    // 1. Dự án candidates rỗng hiện "Dự án chỉ có một người"
    expect(
      screen.getByText('Dự án chỉ có một người, không chuyển được. Chỉ có thể lưu trữ.')
    ).toBeTruthy();

    // 2. Chọn chủ mới cho Project 1
    const select = screen.getByLabelText('Chủ mới');
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: '3' } });

    // Bấm nút "Chuyển chủ"
    const transferBtn = screen.getByText('Chuyển chủ');
    expect(transferBtn).toBeTruthy();
    fireEvent.click(transferBtn);

    // Xác nhận gọi onTransfer('1', '3')
    await waitFor(() => {
      expect(onTransfer).toHaveBeenCalledWith('1', '3');
    });

    // Dự án biến khỏi danh sách của drawer
    await waitFor(() => {
      expect(screen.queryByText('Project One')).toBeNull();
    });

    // Dự án Solo Project vẫn còn
    expect(screen.getByText('Solo Project')).toBeTruthy();
  });

  it('khi người dùng không sở hữu dự án nào thì hiển thị thông báo rỗng', async () => {
    loadOwnedProjects.mockResolvedValue([]);

    render(
      <OwnedProjectsDrawer
        user={mockUser}
        onClose={onClose}
        loadOwnedProjects={loadOwnedProjects}
        onTransfer={onTransfer}
      />
    );

    expect(await screen.findByText('Người dùng này không sở hữu dự án nào.')).toBeTruthy();
  });
});
