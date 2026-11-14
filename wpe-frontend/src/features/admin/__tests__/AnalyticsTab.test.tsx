// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AnalyticsTab } from '../tabs/AnalyticsTab';
import type { AdminStatsDto, AdminTrendPointDto } from '../../../types/admin.types';

describe('AnalyticsTab Component', () => {
  const onRangeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockStats: AdminStatsDto = {
    users: {
      total: 125,
      active: 120,
      suspended: 5,
      newLast7Days: 12,
    },
    projects: {
      total: 35,
      byStatus: {
        ACTIVE: 18,
        PLANNING: 7,
        COMPLETED: 6,
        ARCHIVED: 4,
      },
      newLast7Days: 4,
    },
    tasks: {
      total: 240,
      byStatus: {
        LOCKED: 20,
        TODO: 50,
        IN_PROGRESS: 80,
        REVIEW: 30,
        DONE: 60,
      },
      overdue: 8,
    },
    templates: {
      publicCount: 6,
      privateCount: 14,
      totalClones: 85,
    },
    roles: {
      systemRoles: {
        ADMIN: 3,
        USER: 122,
      },
      projectRoles: {
        OWNER: 35,
        MANAGER: 25,
        COLLABORATOR: 70,
        VIEWER: 15,
      },
    },
  };

  const mockTrends: AdminTrendPointDto[] = [
    { date: '2026-10-01', newUsers: 2, newProjects: 1, tasksDone: 5 },
    { date: '2026-10-02', newUsers: 3, newProjects: 0, tasksDone: 8 },
  ];

  it('render với stats mẫu thấy số user đúng và không còn chữ "Uptime"/"Error rate"/"DAG executions"', () => {
    const { container } = render(
      <AnalyticsTab
        stats={mockStats}
        trends={mockTrends}
        trendRange="7D"
        onRangeChange={onRangeChange}
      />
    );

    // 1. Kiểm tra thấy số user đúng
    expect(screen.getByText('125')).toBeTruthy();
    expect(screen.getByText(/đang khóa 5, mới 7 ngày 12/)).toBeTruthy();

    // 2. Kiểm tra các số KPI khác
    expect(screen.getByText('18')).toBeTruthy(); // Dự án đang chạy (ACTIVE)
    expect(screen.getByText('8')).toBeTruthy(); // Task trễ hạn
    expect(screen.getByText('6')).toBeTruthy(); // Template PUBLIC

    // 3. Không còn chữ Uptime, Error rate, DAG executions
    const textContent = container.textContent || '';
    expect(textContent.toLowerCase()).not.toContain('uptime');
    expect(textContent.toLowerCase()).not.toContain('error rate');
    expect(textContent.toLowerCase()).not.toContain('dag executions');
  });

  it('bấm đổi khoảng thời gian gọi onRangeChange', () => {
    render(
      <AnalyticsTab
        stats={mockStats}
        trends={mockTrends}
        trendRange="7D"
        onRangeChange={onRangeChange}
      />
    );

    const btn30D = screen.getByText('30 Ngày');
    fireEvent.click(btn30D);
    expect(onRangeChange).toHaveBeenCalledWith('30D');
  });

  it('có errorMessage thì hiện khung lỗi và không thấy ô KPI', () => {
    render(
      <AnalyticsTab
        stats={mockStats}
        trends={mockTrends}
        trendRange="7D"
        onRangeChange={onRangeChange}
        errorMessage="Không thể kết nối dịch vụ thống kê"
      />
    );

    expect(screen.getByText(/Chưa có dữ liệu: Không thể kết nối dịch vụ thống kê/)).toBeTruthy();
    expect(screen.queryByText('Người dùng')).toBeNull();
    expect(screen.queryByText('Dự án đang chạy')).toBeNull();
  });

  it('stats null và không có errorMessage thì hiện "Đang tải..."', () => {
    render(
      <AnalyticsTab
        stats={null}
        trends={[]}
        trendRange="7D"
        onRangeChange={onRangeChange}
      />
    );

    expect(screen.getByText('Đang tải...')).toBeTruthy();
  });
});
