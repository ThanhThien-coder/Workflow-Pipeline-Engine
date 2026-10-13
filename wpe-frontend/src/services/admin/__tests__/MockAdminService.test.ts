import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdminService } from '../MockAdminService';

describe('Clean Architecture DI: MockAdminService Unit Tests', () => {
  let service: MockAdminService;

  beforeEach(() => {
    service = new MockAdminService();
  });

  it('should return system KPIs matching Spring Boot DTO', async () => {
    const kpis = await service.getSystemKpis();
    expect(kpis).toBeDefined();
    expect(kpis.totalUsers).toBe(1284);
    expect(kpis.systemUptimePercentage).toBe(99.98);
    expect(kpis.errorRatePercentage).toBe(0.02);
  });

  it('should return analytics trends for 7D and 30D', async () => {
    const trends7 = await service.getAnalyticsTrends('7D');
    expect(trends7).toHaveLength(7);
    expect(trends7[0].label).toBe('Mon');

    const trends30 = await service.getAnalyticsTrends('30D');
    expect(trends30).toHaveLength(7);
    expect(trends30[0].label).toBe('Sep 7');
  });

  it('should return role distribution', async () => {
    const roles = await service.getRoleDistribution();
    expect(roles.ownerCount).toBe(22);
    expect(roles.collaboratorCount).toBe(56);
    expect(roles.viewerCount).toBe(22);
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

  it('should suspend a user and reject suspending Super Admin', async () => {
    // Attempting to suspend Super Admin should throw
    await expect(
      service.suspendUser({ userId: 'usr_01AKM9', reason: 'TERMS_VIOLATION' })
    ).rejects.toThrow('Cannot suspend Super Admin account');

    // Suspend Sarah Chen
    const suspended = await service.suspendUser({
      userId: 'usr_02JQ71',
      reason: 'SECURITY_RISK',
    });
    expect(suspended.status).toBe('SUSPENDED');

    // Verify in audit logs
    const logs = await service.getSecurityAuditLogs();
    expect(logs[0].action).toBe('USER_SUSPENDED');
  });

  it('should unban a suspended user', async () => {
    const unbanned = await service.unbanUser('usr_03PL44');
    expect(unbanned.status).toBe('ACTIVE');

    // Verify in audit logs
    const logs = await service.getSecurityAuditLogs();
    expect(logs[0].action).toBe('USER_UNBANNED');
  });

  it('should return workspaces and security audit logs', async () => {
    const workspaces = await service.getWorkspaces();
    expect(workspaces.length).toBeGreaterThan(0);
    expect(workspaces[0].status).toBe('RUNNING');

    const logs = await service.getSecurityAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
  });
});
