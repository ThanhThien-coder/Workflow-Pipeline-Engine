export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD_USER';
export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminUserDto {
  id: string;
  name: string;
  maskedEmail: string;       // e.g. "al***im@pipeline.engine"
  role: AdminRole;
  workspaceCount: number;
  lastLoginAt: string;       // ISO 8601 string
  maskedIp: string;          // e.g. "172.16.0.***"
  status: UserAccountStatus;
}

export interface SuspendUserRequestDto {
  userId: string;
  reason: 'TERMS_VIOLATION' | 'SECURITY_RISK' | 'BILLING_OVERDUE' | 'OTHER';
  note?: string;
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
  status: 'RUNNING' | 'IDLE' | 'FAILED';
}

export interface SecurityAuditLogDto {
  id: string;
  timestamp: string;         // ISO 8601 string
  actorName: string;
  action: 'USER_SUSPENDED' | 'USER_UNBANNED' | 'ROLE_UPDATED' | 'FAILED_LOGIN';
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED';
  maskedIp: string;
}

export type AdminTabId = 'overview' | 'users' | 'workspaces' | 'audit' | 'analytics' | 'logs';
