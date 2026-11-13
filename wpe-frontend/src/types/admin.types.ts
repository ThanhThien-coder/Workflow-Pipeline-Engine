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
  durationDays?: number;
}

export interface SystemKpiDto {
  totalUsers: number;
  userGrowthRate: number;
  activeWorkspaces: number;
  newWorkspacesThisWeek: number;
  dagExecutions: number;
  throughputPerMinute: number;
  systemUptimePercentage: number;
  errorRatePercentage: number;
}

export interface AnalyticsTrendPointDto {
  label: string;             // e.g. "Week 1", "Week 2"
  dagExecutions: number;
  activeUsers: number;
}

export interface RoleDistributionDto {
  ownerCount: number;
  collaboratorCount: number;
  viewerCount: number;
}

export interface WorkspaceOverviewDto {
  id: string;
  name: string;
  ownerName: string;
  nodeCount: number;
  criticalPathCount: number;
  progressPercentage: number;
  status: 'RUNNING' | 'IDLE' | 'FAILED' | 'ARCHIVED';
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
