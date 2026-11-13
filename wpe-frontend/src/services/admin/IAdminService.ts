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

export interface IAdminService {
  getStats(): Promise<AdminStatsDto>;
  getTrends(range: '7D' | '30D'): Promise<AdminTrendPointDto[]>;
  getUsers(query?: string, status?: string): Promise<AdminUserDto[]>;
  suspendUser(payload: SuspendUserRequestDto): Promise<AdminUserDto>;
  unbanUser(userId: string): Promise<AdminUserDto>;
  changeUserRole(userId: string, role: 'ADMIN' | 'USER'): Promise<AdminUserDto>;
  deleteUser(userId: string): Promise<void>;
  getOwnedProjects(userId: string): Promise<OwnedProjectDto[]>;
  transferProjectOwner(projectId: string, newOwnerId: string): Promise<OwnedProjectDto>;
  getWorkspaces(query?: string, status?: string): Promise<AdminWorkspaceDto[]>;
  archiveWorkspace(workspaceId: string): Promise<AdminWorkspaceDto>;
  getWorkspaceDetail(workspaceId: string): Promise<AdminWorkspaceDetailDto>;
  getSecurityAuditLogs(group?: AuditLogGroup): Promise<SecurityAuditLogDto[]>;
}
