import type { ProjectRole } from '../../types/settings.types'

/** true = được phép, false = không, string = được phép kèm ghi chú ngắn. */
export type PermissionValue = boolean | string

export interface RolePermissionRow {
  action: string
  owner: PermissionValue
  manager: PermissionValue
  collaborator: PermissionValue
  viewer: PermissionValue
}

export const ROLE_ORDER: ProjectRole[] = ['OWNER', 'MANAGER', 'COLLABORATOR', 'VIEWER']

export const ROLE_TITLES: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  COLLABORATOR: 'Collaborator',
  VIEWER: 'Viewer',
}

/** Mô tả ngắn từng vai trò (dùng cho tooltip). */
export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  OWNER: 'Full control: edits the pipeline, manages members and settings, and can do everything a Manager does.',
  MANAGER: 'Edits the pipeline, unlocks tasks early, approves or returns tasks, assigns people and due dates, and handles guest feedback. Cannot publish the pipeline or manage members and settings.',
  COLLABORATOR: 'Works on assigned tasks (start, return, submit) and adds artifacts. Cannot edit the pipeline or review work.',
  VIEWER: 'Read-only: can view the pipeline, tasks and artifacts, and run AI Diagnosis.',
}

/** Một câu tóm tắt quyền, hiện ở SettingsHeader. */
export const ROLE_SUMMARIES: Record<ProjectRole, string> = {
  OWNER: 'You can edit the pipeline, manage members and settings, and review all work.',
  MANAGER: 'You can edit the pipeline, unlock tasks early, approve or return tasks, assign people and due dates, and handle guest feedback. You cannot publish the pipeline or manage members and settings.',
  COLLABORATOR: 'You can work on your assigned tasks and add artifacts. You cannot edit the pipeline or review work.',
  VIEWER: 'You can view the pipeline, tasks and artifacts. You cannot make changes.',
}

/** Mô tả dùng trong lựa chọn khi mời thành viên (không có OWNER vì không mời trực tiếp). */
export const INVITE_ROLE_HINTS: Record<'MANAGER' | 'COLLABORATOR' | 'VIEWER', string> = {
  MANAGER: 'Can approve or return tasks and assign people',
  COLLABORATOR: 'Can work on assigned tasks and add artifacts',
  VIEWER: 'Read-only access',
}

const row = (
  action: string,
  owner: PermissionValue,
  manager: PermissionValue,
  collaborator: PermissionValue,
  viewer: PermissionValue,
): RolePermissionRow => ({ action, owner, manager, collaborator, viewer })

/** Khớp kiểm quyền backend (ProjectAuthorizationService và các service gọi nó). */
export const ROLE_PERMISSIONS: RolePermissionRow[] = [
  row('View pipeline graph, Kanban, Overview and artifacts', true, true, true, true),
  row('Run AI Diagnosis', true, true, true, true),
  row('Edit pipeline (phases, tasks, links, ghost nodes)', true, true, false, false),
  row('Publish pipeline', true, false, false, false),
  row('Unlock a task early', true, true, false, false),
  row('Rename or edit project details', true, false, false, false),
  row('Archive, restore or delete project', true, false, false, false),
  row('Save project as template', true, false, false, false),
  row('Invite members, change roles, remove members, transfer ownership', true, false, false, false),
  row('Create or revoke guest links', true, false, false, false),
  row('Approve or return tasks', true, true, false, false),
  row('Reopen a done task', true, true, false, false),
  row('Review queue', true, true, false, false),
  row('Change assignee and due date', true, true, false, false),
  row('Resolve guest feedback', true, true, false, false),
  row('Start, return or submit a task', 'Any task', 'If assigned', 'If assigned', false),
  row('Work on tasks while the project is not active (Draft, Paused, Completed)', true, true, false, false),
  row('Start, pause, complete or reopen the project (Workflow screen)', true, false, false, false),
  row('Add artifacts', true, true, true, false),
  row('Delete an artifact', true, 'Own uploads', 'Own uploads', 'Own uploads'),
]

export function permissionForRole(r: RolePermissionRow, role: ProjectRole): PermissionValue {
  switch (role) {
    case 'OWNER': return r.owner
    case 'MANAGER': return r.manager
    case 'COLLABORATOR': return r.collaborator
    default: return r.viewer
  }
}
