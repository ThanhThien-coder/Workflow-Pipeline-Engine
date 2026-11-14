import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdminService } from '../MockAdminService';

describe('Clean Architecture DI: MockAdminService Unit Tests', () => {
  let service: MockAdminService;

  beforeEach(() => {
    service = new MockAdminService();
  });

  it('should return admin stats matching Spring Boot DTO', async () => {
    const stats = await service.getStats();
    expect(stats).toBeDefined();
    expect(stats.users.total).toBe(6);
    expect(stats.projects.total).toBe(3);
    expect(stats.tasks.total).toBe(39);
    expect(stats.templates.publicCount).toBe(3);
  });

  it('should return analytics trends for 7D and 30D', async () => {
    const trends7 = await service.getTrends('7D');
    expect(trends7).toHaveLength(7);
    expect(trends7[0].date).toBeDefined();
    expect(typeof trends7[0].newUsers).toBe('number');

    const trends30 = await service.getTrends('30D');
    expect(trends30).toHaveLength(30);
  });

  it('should fetch users and filter by query and status', async () => {
    const allUsers = await service.getUsers();
    expect(allUsers.length).toBeGreaterThanOrEqual(6);

    const activeUsers = await service.getUsers(undefined, 'ACTIVE');
    expect(activeUsers.every((u) => u.status === 'ACTIVE')).toBe(true);

    const searched = await service.getUsers('Sarah');
    expect(searched).toHaveLength(1);
    expect(searched[0].name).toBe('Sarah Chen');
  });

  it('should suspend a user and reject suspending Super Admin/Admin', async () => {
    await expect(
      service.suspendUser({ userId: 'usr_01AKM9', reason: 'TERMS_VIOLATION' })
    ).rejects.toThrow('Cannot suspend Admin account');

    const suspended = await service.suspendUser({
      userId: 'usr_04DV88',
      reason: 'SECURITY_RISK',
    });
    expect(suspended.status).toBe('SUSPENDED');

    const logs = await service.getSecurityAuditLogs('ADMIN');
    expect(logs[0].action).toBe('USER_SUSPENDED');
  });

  it('should unban a suspended user', async () => {
    const unbanned = await service.unbanUser('usr_03PL44');
    expect(unbanned.status).toBe('ACTIVE');

    const logs = await service.getSecurityAuditLogs();
    expect(logs[0].action).toBe('USER_UNBANNED');
  });

  it('should return workspaces and get workspace detail', async () => {
    const workspaces = await service.getWorkspaces();
    expect(workspaces.length).toBe(3);
    expect(workspaces[0].status).toBe('ACTIVE');

    const detail = await service.getWorkspaceDetail('ws_01');
    expect(detail).toBeDefined();
    expect(detail.id).toBe('ws_01');
    expect(detail.owner.ownerName).toBe('Sarah Chen');
    expect(detail.membersByRole.OWNER).toBe(1);
    expect(detail.ownerCandidates.length).toBeGreaterThan(0);
  });

  it('should archive a workspace', async () => {
    const archived = await service.archiveWorkspace('ws_01');
    expect(archived.status).toBe('ARCHIVED');

    const logs = await service.getSecurityAuditLogs('ADMIN');
    expect(logs[0].action).toBe('WORKSPACE_ARCHIVED');
  });

  it('should filter audit logs by group', async () => {
    const loginLogs = await service.getSecurityAuditLogs('LOGIN');
    expect(loginLogs.length).toBeGreaterThan(0);
    expect(loginLogs.every((l) => ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'ACCOUNT_LOCKED_LOGIN'].includes(l.action))).toBe(true);

    const adminLogs = await service.getSecurityAuditLogs('ADMIN');
    expect(adminLogs.length).toBeGreaterThan(0);
    expect(adminLogs.every((l) => ['USER_SUSPENDED', 'USER_UNBANNED', 'WORKSPACE_ARCHIVED'].includes(l.action))).toBe(true);

    const templateLogs = await service.getSecurityAuditLogs('TEMPLATE');
    expect(templateLogs.length).toBeGreaterThan(0);
    expect(templateLogs.every((l) => ['TEMPLATE_CREATED', 'TEMPLATE_UPDATED', 'TEMPLATE_DELETED'].includes(l.action))).toBe(true);
  });
});
