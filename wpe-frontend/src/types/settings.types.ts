export type ISODateTime = string;
export type ProjectRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER';
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

export interface ProjectInvitationDto {
  id: string;
  projectId: string;
  projectName: string;
  inviterId: string;
  inviterName: string;
  inviterEmail?: string;
  inviteeId?: string;
  inviteeEmail: string;
  role: 'COLLABORATOR' | 'VIEWER';
  status: InvitationStatus;
  createdAt: ISODateTime;
  respondedAt?: ISODateTime | null;
  expiresAt: ISODateTime;
  version?: number;
}

export type AuditLogAction =
  | 'MEMBER_INVITED'
  | 'ROLE_CHANGED'
  | 'MEMBER_REMOVED'
  | 'PIPELINE_PUBLISHED'
  | 'PROJECT_UPDATED'
  | 'RESOURCE_ADDED'
  | 'RESOURCE_REMOVED'
  | 'RESOURCE_UPDATED';

export type AuditScope = 'Governance' | 'Lifecycle' | 'Access';

export interface AuditLogItem {
  id: string;
  timestamp: ISODateTime;
  actor: {
    userId: string;
    name: string;
    role: ProjectRole | 'SYSTEM';
  };
  action: AuditLogAction;
  details: string;
  scope: AuditScope;
}

export interface ProjectMemberDetail {
  userId: string;
  username: string;
  email: string;
  role: ProjectRole;
  joinedAt: ISODateTime;
  activeNodeCount: number; // Đếm số node đang phụ trách để cảnh báo khi kick
  avatarClass: string;
  initials: string;
  avatarUrl?: string | null;
}

export interface ProjectSettingsDto {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  myRole: ProjectRole;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* Commands (Tương đương Request Body của Spring Boot @RequestBody) */
export interface UpdateProjectCommand {
  name: string;
  description: string;
}

export interface InviteMemberCommand {
  usernameOrEmail: string;
  role: 'COLLABORATOR' | 'VIEWER';
}

export interface ChangeMemberRoleCommand {
  role: 'COLLABORATOR' | 'VIEWER';
}

export interface PublishPipelineResult {
  success: boolean;
  newStatus?: ProjectStatus;
  cycleDetected?: boolean;
  violatingNodeIds?: string[]; // Trả về danh sách node vi phạm nếu có chu trình (HTTP 400)
}
