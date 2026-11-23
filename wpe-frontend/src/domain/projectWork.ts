/**
 * Ai được thao tác task theo trạng thái dự án (khớp StateMachineService.ensureProjectRunningForMember ở backend):
 * - Chủ dự án và Quản lý: làm task ở mọi trạng thái trừ ARCHIVED.
 * - Dự án ARCHIVED: mọi người chỉ xem (backend trả 409 PROJECT_ARCHIVED), chỉ mở lại được ở Settings.
 * - Cộng tác viên (và Viewer): chỉ làm task khi dự án ACTIVE (đã Start); DRAFT thì chỉ xem.
 */
const NOT_RUNNING_LABEL: Record<string, string> = {
  DRAFT: 'not started yet',
}

/** Dự án đã Start (publish) chưa: DRAFT là chưa. Chưa tải trạng thái thì coi như chưa. */
export function isProjectStarted(projectStatus: string | null | undefined): boolean {
  return !!projectStatus && projectStatus !== 'DRAFT'
}

export function isMemberWorkLocked(projectStatus: string | null | undefined, role: string | null | undefined): boolean {
  if (projectStatus === 'ARCHIVED') return true
  if (!projectStatus || projectStatus === 'ACTIVE') return false
  return role !== 'OWNER' && role !== 'MANAGER'
}

export function memberWorkLockedMessage(projectStatus: string | null | undefined): string {
  if (projectStatus === 'ARCHIVED') return 'This project is archived and read-only. Restore it to Active in Settings to make changes.'
  const label = (projectStatus && NOT_RUNNING_LABEL[projectStatus]) || 'not active'
  return `This project is ${label}. Only the owner or a manager can work on tasks until it is active.`
}
