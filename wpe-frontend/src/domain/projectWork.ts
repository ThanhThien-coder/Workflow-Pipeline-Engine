/**
 * Ai được thao tác task theo trạng thái dự án (khớp StateMachineService.ensureProjectRunningForMember ở backend):
 * - Chủ dự án và Quản lý: làm task ở mọi trạng thái (trừ ARCHIVED: mọi người chỉ xem, xử lý riêng).
 * - Cộng tác viên (và Viewer): chỉ làm task khi dự án ACTIVE; DRAFT/PLANNING/PAUSED/COMPLETED thì chỉ xem.
 */
const NOT_RUNNING_LABEL: Record<string, string> = {
  DRAFT: 'not started yet',
  PLANNING: 'not started yet',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  INACTIVE: 'inactive',
}

/** Dự án đã Start (publish) chưa: DRAFT/PLANNING là chưa. Chưa tải trạng thái thì coi như chưa. */
export function isProjectStarted(projectStatus: string | null | undefined): boolean {
  return !!projectStatus && projectStatus !== 'DRAFT' && projectStatus !== 'PLANNING'
}

export function isMemberWorkLocked(projectStatus: string | null | undefined, role: string | null | undefined): boolean {
  if (!projectStatus || projectStatus === 'ACTIVE' || projectStatus === 'ARCHIVED') return false
  return role !== 'OWNER' && role !== 'MANAGER'
}

export function memberWorkLockedMessage(projectStatus: string | null | undefined): string {
  const label = (projectStatus && NOT_RUNNING_LABEL[projectStatus]) || 'not active'
  return `This project is ${label}. Only the owner or a manager can work on tasks until it is active.`
}
