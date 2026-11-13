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

export interface IAdminService {
  getSystemKpis(): Promise<SystemKpiDto>;
  getAnalyticsTrends(range: '7D' | '30D'): Promise<AnalyticsTrendPointDto[]>;
  getRoleDistribution(): Promise<RoleDistributionDto>;
  getUsers(query?: string, status?: string): Promise<AdminUserDto[]>;
  suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto>;
  unbanUser(userId: string): Promise<AdminUserDto>;
  changeUserRole(userId: string, role: 'ADMIN' | 'USER'): Promise<AdminUserDto>;
  deleteUser(userId: string): Promise<void>;
  getOwnedProjects(userId: string): Promise<OwnedProjectDto[]>;
  transferProjectOwner(projectId: string, newOwnerId: string): Promise<OwnedProjectDto>;
  getWorkspaces(): Promise<WorkspaceOverviewDto[]>;
  archiveWorkspace(workspaceId: string): Promise<WorkspaceOverviewDto>;
  getSecurityAuditLogs(group?: AuditLogGroup): Promise<SecurityAuditLogDto[]>;
}
