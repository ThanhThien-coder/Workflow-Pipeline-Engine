// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditLogsTab } from '../tabs/AuditLogsTab';
import type { SecurityAuditLogDto } from '../../../types/admin.types';

describe('AuditLogsTab Component', () => {
  it('render 2 log (LOGIN_FAILED, USER_SUSPENDED) -> thấy "Đăng nhập thất bại", "Khóa tài khoản"; bấm nút "Đăng nhập" gọi onGroupChange("LOGIN")', () => {
    const onGroupChange = vi.fn();
    const mockLogs: SecurityAuditLogDto[] = [
      {
        id: '1',
        timestamp: '2026-10-06T12:00:00Z',
        actorName: 'alex.kim',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        targetId: '2',
        detail: 'Sai mật khẩu',
        maskedIp: '192.168.1.***',
      },
      {
        id: '2',
        timestamp: '2026-10-06T12:05:00Z',
        actorName: 'admin',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: '3',
        detail: 'Vi phạm quy định',
        maskedIp: '10.0.0.***',
      },
    ];

    render(
      <AuditLogsTab
        auditLogs={mockLogs}
        group="ALL"
        onGroupChange={onGroupChange}
      />
    );

    expect(screen.getByText('Đăng nhập thất bại')).toBeTruthy();
    expect(screen.getByText('Khóa tài khoản')).toBeTruthy();

    const loginFilterBtn = screen.getByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(loginFilterBtn);

    expect(onGroupChange).toHaveBeenCalledTimes(1);
    expect(onGroupChange).toHaveBeenCalledWith('LOGIN');
  });

  it('hiển thị thông báo khi có errorMessage', () => {
    render(
      <AuditLogsTab
        auditLogs={[]}
        group="ALL"
        errorMessage="Không có quyền truy cập"
      />
    );

    expect(screen.getByText('Chưa có dữ liệu: Không có quyền truy cập')).toBeTruthy();
  });

  it('hiển thị "Chưa có nhật ký nào" khi danh sách trống và không có lỗi', () => {
    render(<AuditLogsTab auditLogs={[]} group="ALL" />);
    expect(screen.getByText('Chưa có nhật ký nào')).toBeTruthy();
  });
});
