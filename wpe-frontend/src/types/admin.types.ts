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
  /** A6: backend nhận nhưng CHƯA lưu hạn khóa (chỉ ghi log), khóa tới khi unban. */
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
  criticalPathCount: number;     // A6: backend chưa trả, HttpAdminService đặt 0
  progressPercentage: number;    // A6: backend chưa trả, HttpAdminService đặt 0
  status: 'RUNNING' | 'IDLE' | 'FAILED' | 'ARCHIVED';
  /** A6: có khi gọi backend thật */
  memberCount?: number;
  /** A6: trạng thái gốc của dự án (DRAFT, ACTIVE, ARCHIVED, ...) */
  projectStatus?: ProjectStatusApi;
  updatedAt?: string;            // ISO 8601 string
}

// ---------------------------------------------------------------------------
// A6 — Dạng JSON backend trả về (integration map 10.1, 10.2). HttpAdminService map sang kiểu UI ở trên.
// ---------------------------------------------------------------------------

export type ProjectStatusApi =
  | 'DRAFT'
  | 'PLANNING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'INACTIVE'
  | 'ARCHIVED';

/** GET /admin/users, POST /admin/users/{id}/suspend|unban. Email đã che ở backend. */
export interface AdminUserApiDto {
  id: string;
  username: string;
  name: string;
  maskedEmail: string;
  role: 'ADMIN' | 'USER';
  workspaceCount: number;
  lastLoginAt: string | null;    // DB chưa lưu, luôn null
  maskedIp: string | null;       // DB chưa lưu, luôn null
  status: UserAccountStatus;
}

/** Body POST /admin/users/{id}/suspend */
export interface SuspendUserApiRequest {
  reason: string;
  durationDays?: number;
}

/** GET /admin/workspaces, POST /admin/workspaces/{id}/archive. Chỉ metadata, không có nội dung task. */
export interface WorkspaceOverviewApiDto {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  status: ProjectStatusApi;
  memberCount: number;
  nodeCount: number;
  updatedAt: string | null;
}

export interface SecurityAuditLogDto {
  id: string;
  timestamp: string;         // ISO 8601 string
  actorName: string;
  action: 'USER_SUSPENDED' | 'USER_UNBANNED' | 'ROLE_UPDATED' | 'FAILED_LOGIN';
  status: 'SUCCESS' | 'WARNING' | 'BLOCKED';
  maskedIp: string;
}

export type AdminTabId = 'overview' | 'users' | 'workspaces' | 'audit' | 'analytics' | 'logs' | 'templates';
