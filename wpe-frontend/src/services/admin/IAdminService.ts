import type {
  AdminUserDto,
  SuspendUserRequestDto,
  SystemKpiDto,
  AnalyticsTrendPointDto,
  RoleDistributionDto,
  WorkspaceOverviewDto,
  SecurityAuditLogDto,
} from '../../types/admin.types';

export interface IAdminService {
  getSystemKpis(): Promise<SystemKpiDto>;
  getAnalyticsTrends(range: '7D' | '30D'): Promise<AnalyticsTrendPointDto[]>;
  getRoleDistribution(): Promise<RoleDistributionDto>;
  getUsers(query?: string, status?: string): Promise<AdminUserDto[]>;
  suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto>;
  unbanUser(userId: string): Promise<AdminUserDto>;
  getWorkspaces(): Promise<WorkspaceOverviewDto[]>;
  archiveWorkspace(workspaceId: string): Promise<WorkspaceOverviewDto>;
  getSecurityAuditLogs(): Promise<SecurityAuditLogDto[]>;
}
