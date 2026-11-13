import type { IAdminService } from './IAdminService';
import type {
  AdminUserDto,
  SuspendUserRequestDto,
  AdminStatsDto,
  AdminTrendPointDto,
  AdminWorkspaceDto,
  AdminWorkspaceDetailDto,
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

  private workspaces: AdminWorkspaceDto[] = [
    {
      id: 'ws_01',
      name: 'Standard Software Development (SDLC)',
      ownerId: 'usr_02JQ71',
      ownerName: 'Sarah Chen',
      ownerMaskedEmail: 'sa***en@acme.io',
      status: 'ACTIVE',
      memberCount: 4,
      phaseCount: 3,
      nodeCount: 18,
      doneNodeCount: 12,
      progressPercentage: 67,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-10T12:00:00Z',
    },
    {
      id: 'ws_02',
      name: 'Customer Sync Pipeline',
      ownerId: 'usr_05TS16',
      ownerName: 'Diego Santos',
      ownerMaskedEmail: 'di***os@orbitlabs.co',
      status: 'PLANNING',
      memberCount: 3,
      phaseCount: 2,
      nodeCount: 12,
      doneNodeCount: 4,
      progressPercentage: 33,
      createdAt: '2026-10-05T09:00:00Z',
      updatedAt: '2026-10-11T14:30:00Z',
    },
    {
      id: 'ws_03',
      name: 'Legacy Billing Migration',
      ownerId: 'usr_03PL44',
      ownerName: 'Marcus Liu',
      ownerMaskedEmail: 'ma***iu@sgu.edu.vn',
      status: 'ARCHIVED',
      memberCount: 2,
      phaseCount: 1,
      nodeCount: 9,
      doneNodeCount: 9,
      progressPercentage: 100,
      createdAt: '2026-09-15T10:00:00Z',
      updatedAt: '2026-10-01T16:00:00Z',
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

  private async delay(ms = 50): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getStats(): Promise<AdminStatsDto> {
    await this.delay(50);
    const activeUsers = this.users.filter((u) => u.status === 'ACTIVE').length;
    const suspendedUsers = this.users.filter((u) => u.status === 'SUSPENDED').length;

    const projectByStatus: Record<string, number> = {
      DRAFT: 0,
      PLANNING: 0,
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      ARCHIVED: 0,
    };
    for (const w of this.workspaces) {
      projectByStatus[w.status] = (projectByStatus[w.status] || 0) + 1;
    }

    const adminCount = this.users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length;
    const userCount = this.users.filter((u) => u.role === 'STANDARD_USER').length;

    return {
      users: {
        total: this.users.length,
        active: activeUsers,
        suspended: suspendedUsers,
        newLast7Days: 2,
      },
      projects: {
        total: this.workspaces.length,
        byStatus: projectByStatus,
        newLast7Days: 1,
      },
      tasks: {
        total: 39,
        byStatus: {
          LOCKED: 4,
          TODO: 8,
          IN_PROGRESS: 10,
          REVIEW: 5,
          DONE: 12,
        },
        overdue: 3,
      },
      templates: {
        publicCount: 3,
        privateCount: 2,
        totalClones: 18,
      },
      roles: {
        systemRoles: {
          ADMIN: adminCount,
          USER: userCount,
        },
        projectRoles: {
          OWNER: 3,
          MANAGER: 2,
          COLLABORATOR: 4,
          VIEWER: 1,
        },
      },
    };
  }

  async getTrends(range: '7D' | '30D'): Promise<AdminTrendPointDto[]> {
    await this.delay(50);
    const days = range === '30D' ? 30 : 7;
    const result: AdminTrendPointDto[] = [];
    const baseDate = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        newUsers: (i % 3 === 0) ? 1 : 0,
        newProjects: (i % 5 === 0) ? 1 : 0,
        tasksDone: (i % 2 === 0) ? 2 : 1,
      });
    }

    return result;
  }

  async getUsers(query?: string, status?: string): Promise<AdminUserDto[]> {
    await this.delay(50);
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
          u.id.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto> {
    await this.delay(50);
    const user = this.users.find((u) => u.id === payload.userId);
    if (!user) {
      throw new Error(`User with ID ${payload.userId} not found`);
    }
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      throw new Error('Cannot suspend Admin account');
    }

    user.status = 'SUSPENDED';

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
    await this.delay(50);
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    user.status = 'ACTIVE';

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
    await this.delay(50);
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    user.role = role === 'ADMIN' ? 'ADMIN' : 'STANDARD_USER';
    return { ...user };
  }

  async deleteUser(userId: string): Promise<void> {
    await this.delay(50);
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
    await this.delay(50);
    return [];
  }

  async transferProjectOwner(_projectId: string, _newOwnerId: string): Promise<OwnedProjectDto> {
    await this.delay(50);
    throw new Error('Chưa có dữ liệu giả cho chuyển chủ dự án');
  }

  async getWorkspaces(query?: string, status?: string): Promise<AdminWorkspaceDto[]> {
    await this.delay(50);
    let result = [...this.workspaces];
    if (status && status !== 'ALL') {
      result = result.filter((w) => w.status === status);
    }
    if (query) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (w) => w.name.toLowerCase().includes(q) || w.ownerName.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async archiveWorkspace(workspaceId: string): Promise<AdminWorkspaceDto> {
    await this.delay(50);
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

  async getWorkspaceDetail(workspaceId: string): Promise<AdminWorkspaceDetailDto> {
    await this.delay(50);
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    const otherUsers = this.users
      .filter((u) => u.id !== ws.ownerId && u.status === 'ACTIVE')
      .map((u) => ({
        userId: u.id,
        name: u.name,
        username: u.username,
      }));

    return {
      id: ws.id,
      name: ws.name,
      description: 'Dự án quản trị mẫu trong hệ thống',
      status: ws.status,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      owner: {
        ownerId: ws.ownerId,
        ownerName: ws.ownerName,
        ownerMaskedEmail: ws.ownerMaskedEmail,
      },
      membersByRole: {
        OWNER: 1,
        MANAGER: 1,
        COLLABORATOR: 1,
        VIEWER: 1,
      },
      pendingInvitationCount: 1,
      phaseCount: ws.phaseCount,
      nodeCount: ws.nodeCount,
      nodesByStatus: {
        LOCKED: 2,
        TODO: 4,
        IN_PROGRESS: 4,
        REVIEW: 2,
        DONE: ws.doneNodeCount,
      },
      progressPercentage: ws.progressPercentage,
      overdueCount: 1,
      guestLinkActive: true,
      guestLinkExpiresAt: '2026-11-30T23:59:59Z',
      lastActivityAt: ws.updatedAt,
      ownerCandidates: otherUsers,
    };
  }

  async getSecurityAuditLogs(group?: AuditLogGroup): Promise<SecurityAuditLogDto[]> {
    await this.delay(50);
    let result = [...this.auditLogs];
    if (group === 'LOGIN') {
      const loginActions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'ACCOUNT_LOCKED_LOGIN'];
      result = result.filter((l) => loginActions.includes(l.action));
    } else if (group === 'ADMIN') {
      const adminActions = ['USER_SUSPENDED', 'USER_UNBANNED', 'WORKSPACE_ARCHIVED'];
      result = result.filter((l) => adminActions.includes(l.action));
    } else if (group === 'TEMPLATE') {
      const templateActions = ['TEMPLATE_CREATED', 'TEMPLATE_UPDATED', 'TEMPLATE_DELETED'];
      result = result.filter((l) => templateActions.includes(l.action));
    }
    return result;
  }
}
