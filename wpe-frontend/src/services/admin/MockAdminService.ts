import type { IAdminService } from './IAdminService';
import type {
  AdminUserDto,
  SuspendUserRequestDto,
  SystemKpiDto,
  AnalyticsTrendPointDto,
  RoleDistributionDto,
  WorkspaceOverviewDto,
  SecurityAuditLogDto,
  AuditLogGroup,
  OwnedProjectDto,
} from '../../types/admin.types';

export class MockAdminService implements IAdminService {
  private users: AdminUserDto[] = [
    {
      id: 'usr_01AKM9',
      name: 'Alex Kim',
      username: 'alex.kim',
      maskedEmail: 'al***im@pipeline.engine',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 10,
      joinedProjectCount: 8,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'usr_02JQ71',
      name: 'Sarah Chen',
      username: 'sarah.chen',
      maskedEmail: 'sa***en@acme.io',
      role: 'ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 7,
      joinedProjectCount: 5,
      createdAt: '2026-10-02T11:00:00Z',
    },
    {
      id: 'usr_03PL44',
      name: 'Marcus Liu',
      username: 'marcus.liu',
      maskedEmail: 'ma***iu@sgu.edu.vn',
      role: 'STANDARD_USER',
      status: 'SUSPENDED',
      ownedProjectCount: 2,
      joinedProjectCount: 4,
      createdAt: '2026-10-03T12:00:00Z',
    },
    {
      id: 'usr_04DV88',
      name: 'Priya Nair',
      username: 'priya.nair',
      maskedEmail: 'pr***ir@northstar.dev',
      role: 'STANDARD_USER',
      status: 'ACTIVE',
      ownedProjectCount: 4,
      joinedProjectCount: 5,
      createdAt: '2026-10-04T13:00:00Z',
    },
    {
      id: 'usr_05TS16',
      name: 'Diego Santos',
      username: 'diego.santos',
      maskedEmail: 'di***os@orbitlabs.co',
      role: 'ADMIN',
      status: 'ACTIVE',
      ownedProjectCount: 12,
      joinedProjectCount: 9,
      createdAt: '2026-10-05T14:00:00Z',
    },
    {
      id: 'usr_06HY32',
      name: 'Hana Yoshida',
      username: 'hana.yoshida',
      maskedEmail: 'ha***da@tokyodata.jp',
      role: 'STANDARD_USER',
      status: 'SUSPENDED',
      ownedProjectCount: 1,
      joinedProjectCount: 2,
      createdAt: '2026-10-06T15:00:00Z',
    },
  ];

  private kpis: SystemKpiDto = {
    totalUsers: 1284,
    userGrowthRate: 12,
    activeWorkspaces: 342,
    newWorkspacesThisWeek: 18,
    dagExecutions: 48920,
    throughputPerMinute: 340,
    systemUptimePercentage: 99.98,
    errorRatePercentage: 0.02,
  };

  private trends7D: AnalyticsTrendPointDto[] = [
    { label: 'Mon', dagExecutions: 5200, activeUsers: 810 },
    { label: 'Tue', dagExecutions: 6800, activeUsers: 910 },
    { label: 'Wed', dagExecutions: 6100, activeUsers: 875 },
    { label: 'Thu', dagExecutions: 7900, activeUsers: 1020 },
    { label: 'Fri', dagExecutions: 7200, activeUsers: 980 },
    { label: 'Sat', dagExecutions: 8100, activeUsers: 1120 },
    { label: 'Sun', dagExecutions: 7620, activeUsers: 1085 },
  ];

  private trends30D: AnalyticsTrendPointDto[] = [
    { label: 'Sep 7', dagExecutions: 3900, activeUsers: 690 },
    { label: 'Sep 12', dagExecutions: 4500, activeUsers: 740 },
    { label: 'Sep 17', dagExecutions: 5200, activeUsers: 810 },
    { label: 'Sep 22', dagExecutions: 4800, activeUsers: 790 },
    { label: 'Sep 27', dagExecutions: 6100, activeUsers: 900 },
    { label: 'Oct 2', dagExecutions: 6900, activeUsers: 1010 },
    { label: 'Oct 6', dagExecutions: 7620, activeUsers: 1085 },
  ];

  private roleDistribution: RoleDistributionDto = {
    ownerCount: 22,
    collaboratorCount: 56,
    viewerCount: 22,
  };

  private workspaces: WorkspaceOverviewDto[] = [
    {
      id: 'ws_01',
      name: 'Revenue Forecasting DAG',
      ownerName: 'Sarah Chen',
      nodeCount: 18,
      criticalPathCount: 4,
      progressPercentage: 86,
      status: 'RUNNING',
    },
    {
      id: 'ws_02',
      name: 'Customer Sync · Production',
      ownerName: 'Diego Santos',
      nodeCount: 12,
      criticalPathCount: 3,
      progressPercentage: 64,
      status: 'RUNNING',
    },
    {
      id: 'ws_03',
      name: 'ML Feature Store Refresh',
      ownerName: 'Priya Nair',
      nodeCount: 27,
      criticalPathCount: 7,
      progressPercentage: 42,
      status: 'RUNNING',
    },
    {
      id: 'ws_04',
      name: 'Legacy Billing Migration',
      ownerName: 'Marcus Liu',
      nodeCount: 9,
      criticalPathCount: 2,
      progressPercentage: 100,
      status: 'IDLE',
    },
    {
      id: 'ws_05',
      name: 'Compliance Data Snapshot',
      ownerName: 'Hana Yoshida',
      nodeCount: 14,
      criticalPathCount: 5,
      progressPercentage: 28,
      status: 'RUNNING',
    },
  ];

  private auditLogs: SecurityAuditLogDto[] = [
    {
      id: 'log_01',
      timestamp: '2026-10-06T20:42:18+07:00',
      actorName: 'admin',
      action: 'USER_SUSPENDED',
      targetType: 'USER',
      targetId: '3',
      detail: 'reason=TERMS_VIOLATION, durationDays=7, note=Spamming',
      maskedIp: '192.168.1.***',
    },
    {
      id: 'log_02',
      timestamp: '2026-10-06T19:14:03+07:00',
      actorName: 'alex.kim',
      action: 'LOGIN_SUCCESS',
      targetType: 'USER',
      targetId: '2',
      detail: 'Đăng nhập thành công',
      maskedIp: '192.168.1.***',
    },
    {
      id: 'log_03',
      timestamp: '2026-10-06T18:20:44+07:00',
      actorName: 'admin',
      action: 'TEMPLATE_CREATED',
      targetType: 'TEMPLATE',
      targetId: '1',
      detail: 'Standard Software Development (SDLC)',
      maskedIp: '10.0.4.***',
    },
    {
      id: 'log_04',
      timestamp: '2026-10-06T16:55:12+07:00',
      actorName: 'unknown_user',
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      targetId: null,
      detail: 'Không tồn tại tài khoản',
      maskedIp: '203.0.113.***',
    },
    {
      id: 'log_05',
      timestamp: '2026-10-06T15:31:09+07:00',
      actorName: 'admin',
      action: 'USER_UNBANNED',
      targetType: 'USER',
      targetId: '3',
      detail: 'Mở khóa tài khoản',
      maskedIp: '192.168.1.***',
    },
    {
      id: 'log_06',
      timestamp: '2026-10-06T13:08:51+07:00',
      actorName: 'admin',
      action: 'TEMPLATE_UPDATED',
      targetType: 'TEMPLATE',
      targetId: '1',
      detail: 'Cập nhật template SDLC',
      maskedIp: '192.168.5.***',
    },
    {
      id: 'log_07',
      timestamp: '2026-10-06T10:44:27+07:00',
      actorName: 'marcus.liu',
      action: 'ACCOUNT_LOCKED_LOGIN',
      targetType: 'USER',
      targetId: '3',
      detail: 'Tài khoản bị khóa',
      maskedIp: '198.51.100.***',
    },
    {
      id: 'log_08',
      timestamp: '2026-10-06T08:02:16+07:00',
      actorName: 'priya.nair',
      action: 'LOGOUT',
      targetType: 'USER',
      targetId: '4',
      detail: 'Đăng xuất',
      maskedIp: '10.2.8.***',
    },
  ];

  private async delay(ms = 300): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getSystemKpis(): Promise<SystemKpiDto> {
    await this.delay(100);
    return { ...this.kpis };
  }

  async getAnalyticsTrends(range: '7D' | '30D'): Promise<AnalyticsTrendPointDto[]> {
    await this.delay(150);
    return range === '7D' ? [...this.trends7D] : [...this.trends30D];
  }

  async getRoleDistribution(): Promise<RoleDistributionDto> {
    await this.delay(100);
    return { ...this.roleDistribution };
  }

  async getUsers(query?: string, status?: string): Promise<AdminUserDto[]> {
    await this.delay(150);
    let result = [...this.users];
    if (status && status !== 'ALL') {
      result = result.filter((u) => u.status === status);
    }
    if (query) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.maskedEmail.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto> {
    await this.delay(300);
    const user = this.users.find((u) => u.id === payload.userId);
    if (!user) {
      throw new Error(`User with ID ${payload.userId} not found`);
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new Error('Cannot suspend Super Admin account');
    }

    user.status = 'SUSPENDED';

    // Record audit log
    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: 'Alex Kim',
      action: 'USER_SUSPENDED',
      targetType: 'USER',
      targetId: payload.userId,
      detail: `reason=${payload.reason}`,
      maskedIp: '192.168.1.***',
    });

    return { ...user };
  }

  async unbanUser(userId: string): Promise<AdminUserDto> {
    await this.delay(300);
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    user.status = 'ACTIVE';

    // Record audit log
    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: 'Alex Kim',
      action: 'USER_UNBANNED',
      targetType: 'USER',
      targetId: userId,
      detail: null,
      maskedIp: '192.168.1.***',
    });

    return { ...user };
  }

  async changeUserRole(userId: string, role: 'ADMIN' | 'USER'): Promise<AdminUserDto> {
    await this.delay(100);
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    user.role = role === 'ADMIN' ? 'ADMIN' : 'STANDARD_USER';
    return { ...user };
  }

  async deleteUser(userId: string): Promise<void> {
    await this.delay(100);
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    if ((user.ownedProjectCount ?? 0) + (user.joinedProjectCount ?? 0) > 0) {
      throw new Error('Tài khoản đã có dữ liệu. Hãy khóa tài khoản thay vì xóa.');
    }
    this.users = this.users.filter((u) => u.id !== userId);
  }

  async getOwnedProjects(_userId: string): Promise<OwnedProjectDto[]> {
    await this.delay(100);
    return [];
  }

  async transferProjectOwner(_projectId: string, _newOwnerId: string): Promise<OwnedProjectDto> {
    await this.delay(100);
    throw new Error('Chưa có dữ liệu giả cho chuyển chủ dự án');
  }

  async getWorkspaces(): Promise<WorkspaceOverviewDto[]> {
    await this.delay(150);
    return [...this.workspaces];
  }

  async archiveWorkspace(workspaceId: string): Promise<WorkspaceOverviewDto> {
    await this.delay(200);
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    workspace.status = 'ARCHIVED';

    this.auditLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorName: 'Alex Kim',
      action: 'WORKSPACE_ARCHIVED',
      targetType: 'WORKSPACE',
      targetId: workspaceId,
      detail: null,
      maskedIp: '192.168.1.***',
    });

    return { ...workspace };
  }

  async getSecurityAuditLogs(group?: AuditLogGroup): Promise<SecurityAuditLogDto[]> {
    await this.delay(150);
    let result = [...this.auditLogs];
    if (group === 'LOGIN') {
      const loginActions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'ACCOUNT_LOCKED_LOGIN'];
      result = result.filter((l) => loginActions.includes(l.action));
    } else if (group === 'ADMIN') {
      const adminActions = ['USER_SUSPENDED', 'USER_UNBANNED'];
      result = result.filter((l) => adminActions.includes(l.action));
    } else if (group === 'TEMPLATE') {
      const templateActions = ['TEMPLATE_CREATED', 'TEMPLATE_UPDATED', 'TEMPLATE_DELETED'];
      result = result.filter((l) => templateActions.includes(l.action));
    }
    return result;
  }
}
