import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpAdminService } from '../HttpAdminService';
import { apiRequest } from '../../http/apiClient';

vi.mock('../../http/apiClient', () => ({
  apiRequest: vi.fn(),
}));

describe('HttpAdminService', () => {
  let service: HttpAdminService;
  const mockApiRequest = vi.mocked(apiRequest);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HttpAdminService();
  });

  it('getUsers("alex", "SUSPENDED") gọi đúng GET /admin/users với query và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce([
      {
        id: 123,
        name: 'Alex Kim',
        username: 'alex.kim',
        maskedEmail: 'a***@pipeline.engine',
        role: 'USER',
        status: 'SUSPENDED',
        ownedProjectCount: '3',
        joinedProjectCount: '5',
        createdAt: '2026-10-01T10:00:00Z',
      },
    ]);

    const users = await service.getUsers('alex', 'SUSPENDED');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/users', {
      query: { query: 'alex', status: 'SUSPENDED' },
    });

    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({
      id: '123',
      name: 'Alex Kim',
      username: 'alex.kim',
      maskedEmail: 'a***@pipeline.engine',
      role: 'STANDARD_USER',
      status: 'SUSPENDED',
      ownedProjectCount: 3,
      joinedProjectCount: 5,
      createdAt: '2026-10-01T10:00:00Z',
    });
  });

  it('getUsers map role ADMIN thành ADMIN', async () => {
    mockApiRequest.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Admin User',
        username: 'admin',
        maskedEmail: 'a***@pipeline.engine',
        role: 'ADMIN',
        status: 'ACTIVE',
        ownedProjectCount: 0,
        joinedProjectCount: 0,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ]);

    const users = await service.getUsers();
    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/users', { query: undefined });
    expect(users[0].role).toBe('ADMIN');
  });

  it('suspendUser gửi đúng path và body', async () => {
    mockApiRequest.mockResolvedValueOnce({
      id: 2,
      name: 'Alex Kim',
      username: 'alex.kim',
      maskedEmail: 'a***@pipeline.engine',
      role: 'USER',
      status: 'SUSPENDED',
      ownedProjectCount: 1,
      joinedProjectCount: 2,
      createdAt: '2026-10-01T10:00:00Z',
    });

    const result = await service.suspendUser({
      userId: '2',
      reason: 'TERMS_VIOLATION',
      note: 'Spamming',
      durationDays: 7,
    });

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/admin/users/2/suspend', {
      body: {
        reason: 'TERMS_VIOLATION',
        note: 'Spamming',
        durationDays: 7,
      },
    });
    expect(result.status).toBe('SUSPENDED');
    expect(result.role).toBe('STANDARD_USER');
  });

  it('unbanUser gửi đúng path POST /admin/users/{userId}/unban', async () => {
    mockApiRequest.mockResolvedValueOnce({
      id: 2,
      name: 'Alex Kim',
      username: 'alex.kim',
      maskedEmail: 'a***@pipeline.engine',
      role: 'USER',
      status: 'ACTIVE',
      ownedProjectCount: 1,
      joinedProjectCount: 2,
      createdAt: '2026-10-01T10:00:00Z',
    });

    const result = await service.unbanUser('2');

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/admin/users/2/unban');
    expect(result.status).toBe('ACTIVE');
  });

  it('getSystemKpis và các phương thức chưa hỗ trợ reject với "Chưa nối API"', async () => {
    await expect(service.getSystemKpis()).rejects.toThrow('Chưa nối API');
    await expect(service.getAnalyticsTrends('7D')).rejects.toThrow('Chưa nối API');
    await expect(service.getRoleDistribution()).rejects.toThrow('Chưa nối API');
    await expect(service.getWorkspaces()).rejects.toThrow('Chưa nối API');
    await expect(service.archiveWorkspace('ws_1')).rejects.toThrow('Chưa nối API');
  });

  it('getSecurityAuditLogs("LOGIN") gọi đúng path, query và map createdAt -> timestamp', async () => {
    mockApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: 101,
          createdAt: '2026-10-06T12:00:00Z',
          actorUsername: 'alex.kim',
          action: 'LOGIN_SUCCESS',
          targetType: 'USER',
          targetId: '2',
          detail: 'Đăng nhập thành công',
          maskedIp: '192.168.1.***',
        },
        {
          id: 102,
          createdAt: '2026-10-06T12:05:00Z',
          actorUsername: null,
          action: 'LOGIN_FAILED',
          targetType: 'USER',
          targetId: null,
          detail: 'Sai mật khẩu',
          maskedIp: '10.0.0.***',
        },
      ],
      page: 0,
      size: 100,
      totalElements: 2,
    });

    const logs = await service.getSecurityAuditLogs('LOGIN');

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/audit-logs', {
      query: { group: 'LOGIN', size: 100 },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({
      id: '101',
      timestamp: '2026-10-06T12:00:00Z',
      actorName: 'alex.kim',
      action: 'LOGIN_SUCCESS',
      targetType: 'USER',
      targetId: '2',
      detail: 'Đăng nhập thành công',
      maskedIp: '192.168.1.***',
    });
    expect(logs[1].actorName).toBe('Không rõ');
    expect(logs[1].timestamp).toBe('2026-10-06T12:05:00Z');
  });
});
