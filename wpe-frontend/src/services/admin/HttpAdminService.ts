import type { IAdminService } from './IAdminService';
import type {
  AdminUserDto,
  SuspendUserRequestDto,
  AdminStatsDto,
  AdminTrendPointDto,
  AdminWorkspaceDto,
  AdminWorkspaceDetailDto,
  SecurityAuditLogDto,
  AuditLogGroup,
  UserAccountStatus,
  OwnedProjectDto,
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

interface RawOwnerCandidate {
  userId: string | number;
  name?: string;
  username?: string;
}

interface RawOwnedProject {
  projectId: string | number;
  name?: string;
  status?: string;
  memberCount?: string | number;
  candidates?: RawOwnerCandidate[];
}

interface RawAdminWorkspace {
  id: string | number;
  name?: string;
  ownerId?: string | number;
  ownerName?: string;
  ownerMaskedEmail?: string;
  status?: string;
  memberCount?: string | number;
  phaseCount?: string | number;
  nodeCount?: string | number;
  doneNodeCount?: string | number;
  progressPercentage?: string | number;
  createdAt?: string;
  updatedAt?: string;
}

interface RawAdminWorkspaceOwner {
  ownerId?: string | number;
  ownerName?: string;
  ownerMaskedEmail?: string;
}

interface RawAdminWorkspaceDetail {
  id: string | number;
  name?: string;
  description?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: RawAdminWorkspaceOwner;
  membersByRole?: Record<string, number>;
  pendingInvitationCount?: string | number;
  phaseCount?: string | number;
  nodeCount?: string | number;
  nodesByStatus?: Record<string, number>;
  progressPercentage?: string | number;
  overdueCount?: string | number;
  guestLinkActive?: boolean;
  guestLinkExpiresAt?: string | null;
  lastActivityAt?: string | null;
  ownerCandidates?: RawOwnerCandidate[];
}

interface RawAdminStats {
  users?: {
    total?: string | number;
    active?: string | number;
    suspended?: string | number;
    newLast7Days?: string | number;
  };
  projects?: {
    total?: string | number;
    byStatus?: Record<string, number>;
    newLast7Days?: string | number;
  };
  tasks?: {
    total?: string | number;
    byStatus?: Record<string, number>;
    overdue?: string | number;
  };
  templates?: {
    publicCount?: string | number;
    privateCount?: string | number;
    totalClones?: string | number;
  };
  roles?: {
    systemRoles?: Record<string, number>;
    projectRoles?: Record<string, number>;
  };
}

interface RawAdminTrendPoint {
  date?: string;
  newUsers?: string | number;
  newProjects?: string | number;
  tasksDone?: string | number;
}

export function mapAdminUser(raw: RawAdminUser): AdminUserDto {
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

export function mapOwnedProject(raw: RawOwnedProject): OwnedProjectDto {
  return {
    projectId: String(raw.projectId),
    name: raw.name ?? '',
    status: raw.status ?? '',
    memberCount: Number(raw.memberCount ?? 0),
    candidates: (raw.candidates || []).map((c) => ({
      userId: String(c.userId),
      name: c.name ?? '',
      username: c.username ?? '',
    })),
  };
}

export function mapAdminWorkspace(raw: RawAdminWorkspace): AdminWorkspaceDto {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    ownerId: String(raw.ownerId ?? ''),
    ownerName: raw.ownerName ?? '',
    ownerMaskedEmail: raw.ownerMaskedEmail ?? '',
    status: raw.status ?? '',
    memberCount: Number(raw.memberCount ?? 0),
    phaseCount: Number(raw.phaseCount ?? 0),
    nodeCount: Number(raw.nodeCount ?? 0),
    doneNodeCount: Number(raw.doneNodeCount ?? 0),
    progressPercentage: Number(raw.progressPercentage ?? 0),
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

export function mapAdminWorkspaceDetail(raw: RawAdminWorkspaceDetail): AdminWorkspaceDetailDto {
  const membersByRole: Record<string, number> = {};
  if (raw.membersByRole) {
    for (const [k, v] of Object.entries(raw.membersByRole)) {
      membersByRole[k] = Number(v ?? 0);
    }
  }

  const nodesByStatus: Record<string, number> = {};
  if (raw.nodesByStatus) {
    for (const [k, v] of Object.entries(raw.nodesByStatus)) {
      nodesByStatus[k] = Number(v ?? 0);
    }
  }

  return {
    id: String(raw.id),
    name: raw.name ?? '',
    description: raw.description ?? null,
    status: raw.status ?? '',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    owner: {
      ownerId: String(raw.owner?.ownerId ?? ''),
      ownerName: raw.owner?.ownerName ?? '',
      ownerMaskedEmail: raw.owner?.ownerMaskedEmail ?? '',
    },
    membersByRole,
    pendingInvitationCount: Number(raw.pendingInvitationCount ?? 0),
    phaseCount: Number(raw.phaseCount ?? 0),
    nodeCount: Number(raw.nodeCount ?? 0),
    nodesByStatus,
    progressPercentage: Number(raw.progressPercentage ?? 0),
    overdueCount: Number(raw.overdueCount ?? 0),
    guestLinkActive: Boolean(raw.guestLinkActive),
    guestLinkExpiresAt: raw.guestLinkExpiresAt ?? null,
    lastActivityAt: raw.lastActivityAt ?? null,
    ownerCandidates: (raw.ownerCandidates || []).map((c) => ({
      userId: String(c.userId),
      name: c.name ?? '',
      username: c.username ?? '',
    })),
  };
}

export function mapAdminStats(raw: RawAdminStats): AdminStatsDto {
  const projectByStatus: Record<string, number> = {};
  if (raw.projects?.byStatus) {
    for (const [k, v] of Object.entries(raw.projects.byStatus)) {
      projectByStatus[k] = Number(v ?? 0);
    }
  }

  const taskByStatus: Record<string, number> = {};
  if (raw.tasks?.byStatus) {
    for (const [k, v] of Object.entries(raw.tasks.byStatus)) {
      taskByStatus[k] = Number(v ?? 0);
    }
  }

  const systemRoles: Record<string, number> = {};
  if (raw.roles?.systemRoles) {
    for (const [k, v] of Object.entries(raw.roles.systemRoles)) {
      systemRoles[k] = Number(v ?? 0);
    }
  }

  const projectRoles: Record<string, number> = {};
  if (raw.roles?.projectRoles) {
    for (const [k, v] of Object.entries(raw.roles.projectRoles)) {
      projectRoles[k] = Number(v ?? 0);
    }
  }

  return {
    users: {
      total: Number(raw.users?.total ?? 0),
      active: Number(raw.users?.active ?? 0),
      suspended: Number(raw.users?.suspended ?? 0),
      newLast7Days: Number(raw.users?.newLast7Days ?? 0),
    },
    projects: {
      total: Number(raw.projects?.total ?? 0),
      byStatus: projectByStatus,
      newLast7Days: Number(raw.projects?.newLast7Days ?? 0),
    },
    tasks: {
      total: Number(raw.tasks?.total ?? 0),
      byStatus: taskByStatus,
      overdue: Number(raw.tasks?.overdue ?? 0),
    },
    templates: {
      publicCount: Number(raw.templates?.publicCount ?? 0),
      privateCount: Number(raw.templates?.privateCount ?? 0),
      totalClones: Number(raw.templates?.totalClones ?? 0),
    },
    roles: {
      systemRoles,
      projectRoles,
    },
  };
}

export function mapAdminTrendPoint(raw: RawAdminTrendPoint): AdminTrendPointDto {
  return {
    date: raw.date ?? '',
    newUsers: Number(raw.newUsers ?? 0),
    newProjects: Number(raw.newProjects ?? 0),
    tasksDone: Number(raw.tasksDone ?? 0),
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
      },
    });
    return mapAdminUser(raw);
  }

  async unbanUser(userId: string): Promise<AdminUserDto> {
    const raw = await apiRequest<RawAdminUser>('POST', `/admin/users/${userId}/unban`);
    return mapAdminUser(raw);
  }

  async changeUserRole(userId: string, role: 'ADMIN' | 'USER'): Promise<AdminUserDto> {
    const raw = await apiRequest<RawAdminUser>('PATCH', `/admin/users/${userId}/role`, {
      body: { role },
    });
    return mapAdminUser(raw);
  }

  async deleteUser(userId: string): Promise<void> {
    await apiRequest<void>('DELETE', `/admin/users/${userId}`);
  }

  async getOwnedProjects(userId: string): Promise<OwnedProjectDto[]> {
    const data = await apiRequest<RawOwnedProject[]>('GET', `/admin/users/${userId}/owned-projects`);
    return (data || []).map(mapOwnedProject);
  }

  async transferProjectOwner(projectId: string, newOwnerId: string): Promise<OwnedProjectDto> {
    const raw = await apiRequest<RawOwnedProject>('POST', `/admin/projects/${projectId}/transfer-owner`, {
      body: { newOwnerId: Number(newOwnerId) },
    });
    return mapOwnedProject(raw);
  }

  async getStats(): Promise<AdminStatsDto> {
    const raw = await apiRequest<RawAdminStats>('GET', '/admin/stats');
    return mapAdminStats(raw);
  }

  async getTrends(range: '7D' | '30D' = '7D'): Promise<AdminTrendPointDto[]> {
    const data = await apiRequest<RawAdminTrendPoint[]>('GET', '/admin/stats/trends', {
      query: { range },
    });
    return (data || []).map(mapAdminTrendPoint);
  }

  async getWorkspaces(query?: string, status?: string): Promise<AdminWorkspaceDto[]> {
    const queryParams: Record<string, string> = {};
    if (query && query.trim()) {
      queryParams.query = query.trim();
    }
    if (status && status !== 'ALL') {
      queryParams.status = status;
    }

    const data = await apiRequest<RawAdminWorkspace[]>('GET', '/admin/workspaces', {
      query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
    return (data || []).map(mapAdminWorkspace);
  }

  async archiveWorkspace(workspaceId: string): Promise<AdminWorkspaceDto> {
    const raw = await apiRequest<RawAdminWorkspace>('POST', `/admin/workspaces/${workspaceId}/archive`);
    return mapAdminWorkspace(raw);
  }

  async getWorkspaceDetail(workspaceId: string): Promise<AdminWorkspaceDetailDto> {
    const raw = await apiRequest<RawAdminWorkspaceDetail>('GET', `/admin/workspaces/${workspaceId}`);
    return mapAdminWorkspaceDetail(raw);
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
