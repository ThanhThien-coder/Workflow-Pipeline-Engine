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
  UserAccountStatus,
} from '../../types/admin.types';
import { apiRequest } from '../http/apiClient';

interface RawAdminUser {
  id: string | number;
  name?: string;
  username?: string;
  maskedEmail?: string;
  role?: string;
  status?: string;
  ownedProjectCount?: number | string;
  joinedProjectCount?: number | string;
  createdAt?: string;
}

interface RawAuditLogItem {
  id: string | number;
  createdAt?: string;
  actorUsername?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: string | null;
  maskedIp?: string;
}

interface RawAuditLogPage {
  items?: RawAuditLogItem[];
  page: number;
  size: number;
  totalElements: number;
}

function mapAdminUser(raw: RawAdminUser): AdminUserDto {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    username: raw.username ?? '',
    maskedEmail: raw.maskedEmail ?? '',
    role: raw.role === 'ADMIN' ? 'ADMIN' : 'STANDARD_USER',
    status: (raw.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE') as UserAccountStatus,
    ownedProjectCount: Number(raw.ownedProjectCount ?? 0),
    joinedProjectCount: Number(raw.joinedProjectCount ?? 0),
    createdAt: raw.createdAt ?? '',
  };
}

export class HttpAdminService implements IAdminService {
  async getUsers(query?: string, status?: string): Promise<AdminUserDto[]> {
    const queryParams: Record<string, string> = {};
    if (query && query.trim()) {
      queryParams.query = query.trim();
    }
    if (status === 'ACTIVE' || status === 'SUSPENDED') {
      queryParams.status = status;
    }

    const data = await apiRequest<RawAdminUser[]>('GET', '/admin/users', {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });

    return (data || []).map(mapAdminUser);
  }

  async suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto> {
    const raw = await apiRequest<RawAdminUser>('POST', `/admin/users/${payload.userId}/suspend`, {
      body: {
        reason: payload.reason,
        note: payload.note,
        durationDays: payload.durationDays,
      },
    });
    return mapAdminUser(raw);
  }

  async unbanUser(userId: string): Promise<AdminUserDto> {
    const raw = await apiRequest<RawAdminUser>('POST', `/admin/users/${userId}/unban`);
    return mapAdminUser(raw);
  }

  async getSystemKpis(): Promise<SystemKpiDto> {
    throw new Error('Chưa nối API');
  }

  async getAnalyticsTrends(_range: '7D' | '30D'): Promise<AnalyticsTrendPointDto[]> {
    throw new Error('Chưa nối API');
  }

  async getRoleDistribution(): Promise<RoleDistributionDto> {
    throw new Error('Chưa nối API');
  }

  async getWorkspaces(): Promise<WorkspaceOverviewDto[]> {
    throw new Error('Chưa nối API');
  }

  async archiveWorkspace(_workspaceId: string): Promise<WorkspaceOverviewDto> {
    throw new Error('Chưa nối API');
  }

  async getSecurityAuditLogs(group?: AuditLogGroup): Promise<SecurityAuditLogDto[]> {
    const query: Record<string, string | number> = { size: 100 };
    if (group) {
      query.group = group;
    }

    const data = await apiRequest<RawAuditLogPage>('GET', '/admin/audit-logs', {
      query,
    });

    return (data?.items || []).map((item) => ({
      id: String(item.id),
      timestamp: item.createdAt ?? '',
      actorName: item.actorUsername ?? 'Không rõ',
      action: item.action,
      targetType: item.targetType ?? null,
      targetId: item.targetId ?? null,
      detail: item.detail ?? null,
      maskedIp: item.maskedIp ?? '—',
    }));
  }
}
