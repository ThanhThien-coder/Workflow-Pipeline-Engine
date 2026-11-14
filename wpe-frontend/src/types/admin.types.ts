export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD_USER';
export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminUserDto {
  id: string;
  name: string;
  username: string;
  maskedEmail: string;
  role: AdminRole;
  status: UserAccountStatus;
  ownedProjectCount: number;
  joinedProjectCount: number;
  createdAt: string;
}

export interface SuspendUserRequestDto {
  userId: string;
  reason: 'TERMS_VIOLATION' | 'SECURITY_RISK' | 'BILLING_OVERDUE' | 'OTHER';
  note?: string;
}

export interface OwnerCandidateDto {
  userId: string;
  name: string;
  username: string;
}

export interface OwnedProjectDto {
  projectId: string;
  name: string;
  status: string;
  memberCount: number;
  candidates: OwnerCandidateDto[];
}

export interface AdminWorkspaceDto {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerMaskedEmail: string;
  status: string;
  memberCount: number;
  phaseCount: number;
  nodeCount: number;
  doneNodeCount: number;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWorkspaceOwnerDto {
  ownerId: string;
  ownerName: string;
  ownerMaskedEmail: string;
}

export interface AdminWorkspaceDetailDto {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner: AdminWorkspaceOwnerDto;
  membersByRole: Record<string, number>;
  pendingInvitationCount: number;
  phaseCount: number;
  nodeCount: number;
  nodesByStatus: Record<string, number>;
  progressPercentage: number;
  overdueCount: number;
  guestLinkActive: boolean;
  guestLinkExpiresAt: string | null;
  lastActivityAt: string | null;
  ownerCandidates: OwnerCandidateDto[];
}

export interface AdminUserStatsDto {
  total: number;
  active: number;
  suspended: number;
  newLast7Days: number;
}

export interface AdminProjectStatsDto {
  total: number;
  byStatus: Record<string, number>;
  newLast7Days: number;
}

export interface AdminTaskStatsDto {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
}

export interface AdminTemplateStatsDto {
  publicCount: number;
  privateCount: number;
  totalClones: number;
}

export interface AdminRoleStatsDto {
  systemRoles: Record<string, number>;
  projectRoles: Record<string, number>;
}

export interface AdminStatsDto {
  users: AdminUserStatsDto;
  projects: AdminProjectStatsDto;
  tasks: AdminTaskStatsDto;
  templates: AdminTemplateStatsDto;
  roles: AdminRoleStatsDto;
}

export interface AdminTrendPointDto {
  date: string;
  newUsers: number;
  newProjects: number;
  tasksDone: number;
}

export type AuditLogGroup = 'LOGIN' | 'ADMIN' | 'TEMPLATE';

export interface SecurityAuditLogDto {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  maskedIp: string;
}

export type AdminTabId = 'overview' | 'users' | 'workspaces' | 'audit' | 'analytics' | 'logs' | 'templates';
