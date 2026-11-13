import type { IAdminService } from './IAdminService';
import { MockAdminService } from './MockAdminService';
import { apiRequest } from '../http/apiClient';
import type {
  AdminRole,
  AdminUserApiDto,
  AdminUserDto,
  AnalyticsTrendPointDto,
  RoleDistributionDto,
  SecurityAuditLogDto,
  SuspendUserApiRequest,
  SuspendUserRequestDto,
  SystemKpiDto,
  WorkspaceOverviewApiDto,
  WorkspaceOverviewDto,
} from '../../types/admin.types';

/**
 * A6 — Gọi API admin thật (integration map 10.1, 10.2). Mọi request đi qua apiClient nên tự kèm
 * `Authorization: Bearer <jwt>`; backend chỉ nhận JWT của user có system_role = ADMIN.
 * Lỗi backend (403 ACCESS_DENIED, 403 CANNOT_SUSPEND_ADMIN, 401, ...) được ném nguyên dạng ApiError
 * để useAdminPortal hiện toast đúng lời nhắn, không đổi sang dữ liệu giả.
 *
 * GIỮ MOCK (chưa có trong SSOT, chưa có API): getSystemKpis, getAnalyticsTrends,
 * getRoleDistribution, getSecurityAuditLogs.
 */
const EMPTY = '—';

const SUSPEND_REASON_MAX = 255;

function toUiRole(role: AdminUserApiDto['role']): AdminRole {
  return role === 'ADMIN' ? 'ADMIN' : 'STANDARD_USER';
}

function toUiUser(dto: AdminUserApiDto): AdminUserDto {
  return {
    id: String(dto.id),
    name: dto.name || dto.username,
    maskedEmail: dto.maskedEmail,
    role: toUiRole(dto.role),
    workspaceCount: dto.workspaceCount ?? 0,
    lastLoginAt: dto.lastLoginAt ?? EMPTY,
    maskedIp: dto.maskedIp ?? EMPTY,
    status: dto.status,
  };
}

function toUiWorkspaceStatus(status: WorkspaceOverviewApiDto['status']): WorkspaceOverviewDto['status'] {
  if (status === 'ARCHIVED') return 'ARCHIVED';
  if (status === 'ACTIVE') return 'RUNNING';
  return 'IDLE';
}

function toUiWorkspace(dto: WorkspaceOverviewApiDto): WorkspaceOverviewDto {
  return {
    id: String(dto.id),
    name: dto.name,
    ownerName: dto.ownerName ?? EMPTY,
    nodeCount: dto.nodeCount ?? 0,
    // Backend chỉ trả metadata (không đọc task) nên chưa có 2 số này.
    criticalPathCount: 0,
    progressPercentage: 0,
    status: toUiWorkspaceStatus(dto.status),
    memberCount: dto.memberCount ?? 0,
    projectStatus: dto.status,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

export class HttpAdminService implements IAdminService {
  /** Chỉ dùng cho 4 hàm chưa có API. */
  private readonly mock = new MockAdminService();

  async getUsers(query?: string, status?: string): Promise<AdminUserDto[]> {
    const q = query?.trim();
    const data = await apiRequest<AdminUserApiDto[]>('GET', '/admin/users', {
      query: {
        query: q ? q : undefined,
        status: status && status !== 'ALL' ? status : undefined,
      },
    });
    return (data ?? []).map(toUiUser);
  }

  async suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto> {
    const note = payload.note?.trim();
    const reason = (note ? `${payload.reason}: ${note}` : payload.reason).slice(0, SUSPEND_REASON_MAX);
    const body: SuspendUserApiRequest = { reason };
    if (payload.durationDays !== undefined) body.durationDays = payload.durationDays;

    const data = await apiRequest<AdminUserApiDto>(
      'POST',
      `/admin/users/${encodeURIComponent(payload.userId)}/suspend`,
      { body }
    );
    return toUiUser(data);
  }

  async unbanUser(userId: string): Promise<AdminUserDto> {
    const data = await apiRequest<AdminUserApiDto>('POST', `/admin/users/${encodeURIComponent(userId)}/unban`);
    return toUiUser(data);
  }

  async getWorkspaces(): Promise<WorkspaceOverviewDto[]> {
    const data = await apiRequest<WorkspaceOverviewApiDto[]>('GET', '/admin/workspaces');
    return (data ?? []).map(toUiWorkspace);
  }

  async archiveWorkspace(workspaceId: string): Promise<WorkspaceOverviewDto> {
    const data = await apiRequest<WorkspaceOverviewApiDto>(
      'POST',
      `/admin/workspaces/${encodeURIComponent(workspaceId)}/archive`
    );
    return toUiWorkspace(data);
  }

  // ---------------- GIỮ MOCK: chưa có API trong SSOT ----------------

  getSystemKpis(): Promise<SystemKpiDto> {
    return this.mock.getSystemKpis();
  }

  getAnalyticsTrends(range: '7D' | '30D'): Promise<AnalyticsTrendPointDto[]> {
    return this.mock.getAnalyticsTrends(range);
  }

  getRoleDistribution(): Promise<RoleDistributionDto> {
    return this.mock.getRoleDistribution();
  }

  getSecurityAuditLogs(): Promise<SecurityAuditLogDto[]> {
    return this.mock.getSecurityAuditLogs();
  }
}
