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
    });

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/admin/users/2/suspend', {
      body: {
        reason: 'TERMS_VIOLATION',
        note: 'Spamming',
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

  it('getWorkspaces gọi đúng GET /admin/workspaces và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce([
      {
        id: 10,
        name: 'Project Alpha',
        ownerId: 2,
        ownerName: 'Sarah Chen',
        ownerMaskedEmail: 's***@pipeline.engine',
        status: 'ACTIVE',
        memberCount: 4,
        phaseCount: 3,
        nodeCount: 10,
        doneNodeCount: 5,
        progressPercentage: 50,
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-05T12:00:00Z',
      },
    ]);

    const result = await service.getWorkspaces('alpha', 'ACTIVE');

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/workspaces', {
      query: { query: 'alpha', status: 'ACTIVE' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: '10',
      name: 'Project Alpha',
      ownerId: '2',
      ownerName: 'Sarah Chen',
      ownerMaskedEmail: 's***@pipeline.engine',
      status: 'ACTIVE',
      memberCount: 4,
      phaseCount: 3,
      nodeCount: 10,
      doneNodeCount: 5,
      progressPercentage: 50,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
    });
  });

  it('archiveWorkspace("1") gọi POST /admin/workspaces/1/archive và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce({
      id: 1,
      name: 'Project Alpha',
      ownerId: 2,
      ownerName: 'Sarah Chen',
      ownerMaskedEmail: 's***@pipeline.engine',
      status: 'ARCHIVED',
      memberCount: 4,
      phaseCount: 3,
      nodeCount: 10,
      doneNodeCount: 5,
      progressPercentage: 50,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
    });

    const result = await service.archiveWorkspace('1');

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/admin/workspaces/1/archive');
    expect(result.id).toBe('1');
    expect(result.status).toBe('ARCHIVED');
  });

  it('getWorkspaceDetail("1") gọi GET /admin/workspaces/1 và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce({
      id: 1,
      name: 'Project Alpha',
      description: 'Test description',
      status: 'ACTIVE',
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
      owner: {
        ownerId: 2,
        ownerName: 'Sarah Chen',
        ownerMaskedEmail: 's***@pipeline.engine',
      },
      membersByRole: { OWNER: 1, MANAGER: 1, COLLABORATOR: 2, VIEWER: 0 },
      pendingInvitationCount: 2,
      phaseCount: 3,
      nodeCount: 12,
      nodesByStatus: { LOCKED: 2, TODO: 3, IN_PROGRESS: 4, REVIEW: 1, DONE: 2 },
      progressPercentage: 17,
      overdueCount: 1,
      guestLinkActive: true,
      guestLinkExpiresAt: '2026-11-01T00:00:00Z',
      lastActivityAt: '2026-10-05T12:00:00Z',
      ownerCandidates: [{ userId: 3, name: 'Marcus Liu', username: 'marcus.liu' }],
    });

    const detail = await service.getWorkspaceDetail('1');

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/workspaces/1');
    expect(detail.id).toBe('1');
    expect(detail.owner.ownerId).toBe('2');
    expect(detail.membersByRole.OWNER).toBe(1);
    expect(detail.nodesByStatus.DONE).toBe(2);
    expect(detail.guestLinkActive).toBe(true);
    expect(detail.ownerCandidates[0].userId).toBe('3');
  });

  it('getStats gọi GET /admin/stats và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce({
      users: { total: 10, active: 8, suspended: 2, newLast7Days: 3 },
      projects: { total: 5, byStatus: { ACTIVE: 3, ARCHIVED: 2 }, newLast7Days: 1 },
      tasks: { total: 25, byStatus: { DONE: 10, IN_PROGRESS: 15 }, overdue: 2 },
      templates: { publicCount: 4, privateCount: 1, totalClones: 20 },
      roles: {
        systemRoles: { ADMIN: 2, USER: 8 },
        projectRoles: { OWNER: 5, COLLABORATOR: 10 },
      },
    });

    const stats = await service.getStats();

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/stats');
    expect(stats.users.total).toBe(10);
    expect(stats.projects.byStatus.ACTIVE).toBe(3);
    expect(stats.tasks.overdue).toBe(2);
    expect(stats.templates.publicCount).toBe(4);
    expect(stats.roles.systemRoles.ADMIN).toBe(2);
  });

  it('getTrends("30D") gọi GET /admin/stats/trends?range=30D và map dữ liệu', async () => {
    mockApiRequest.mockResolvedValueOnce([
      { date: '2026-10-01', newUsers: 2, newProjects: 1, tasksDone: 5 },
    ]);

    const trends = await service.getTrends('30D');

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/stats/trends', {
      query: { range: '30D' },
    });
    expect(trends).toHaveLength(1);
    expect(trends[0]).toEqual({
      date: '2026-10-01',
      newUsers: 2,
      newProjects: 1,
      tasksDone: 5,
    });
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

  it('changeUserRole("2", "ADMIN") gọi PATCH /admin/users/2/role với body { role: "ADMIN" }', async () => {
    mockApiRequest.mockResolvedValueOnce({
      id: 2,
      name: 'Test User',
      username: 'test.user',
      maskedEmail: 't***@test.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 0,
      joinedProjectCount: 0,
      createdAt: '2026-10-01T10:00:00Z',
    });

    const updated = await service.changeUserRole('2', 'ADMIN');

    expect(mockApiRequest).toHaveBeenCalledWith('PATCH', '/admin/users/2/role', {
      body: { role: 'ADMIN' },
    });
    expect(updated.id).toBe('2');
    expect(updated.role).toBe('ADMIN');
  });

  it('deleteUser("5") gọi DELETE /admin/users/5', async () => {
    mockApiRequest.mockResolvedValueOnce(undefined);

    await service.deleteUser('5');

    expect(mockApiRequest).toHaveBeenCalledWith('DELETE', '/admin/users/5');
  });

  it('transferProjectOwner("1", "3") gọi POST /admin/projects/1/transfer-owner với body { newOwnerId: 3 }', async () => {
    mockApiRequest.mockResolvedValueOnce({
      projectId: 1,
      name: 'Project Alpha',
      status: 'ACTIVE',
      memberCount: 5,
      candidates: [{ userId: 3, name: 'Candidate 3', username: 'cand3' }],
    });

    const result = await service.transferProjectOwner('1', '3');

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/admin/projects/1/transfer-owner', {
      body: { newOwnerId: 3 },
    });
    expect(result.projectId).toBe('1');
    expect(result.candidates[0].userId).toBe('3');
  });

  it('getOwnedProjects("2") gọi GET /admin/users/2/owned-projects và map id sang string', async () => {
    mockApiRequest.mockResolvedValueOnce([
      {
        projectId: 10,
        name: 'Project 10',
        status: 'ACTIVE',
        memberCount: 3,
        candidates: [
          { userId: 20, name: 'User 20', username: 'usr20' },
          { userId: 30, name: 'User 30', username: 'usr30' },
        ],
      },
    ]);

    const projects = await service.getOwnedProjects('2');

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/admin/users/2/owned-projects');
    expect(projects).toHaveLength(1);
    expect(projects[0].projectId).toBe('10');
    expect(projects[0].memberCount).toBe(3);
    expect(projects[0].candidates[0].userId).toBe('20');
    expect(projects[0].candidates[1].userId).toBe('30');
  });
});
