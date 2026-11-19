import type { ProjectSettingsDto } from '../types/settings.types'
import { isMemberWorkLocked } from '../domain/projectWork'

/** Phần state cần để biết dự án đang mở (tách riêng để slice dùng được mà không import vòng useWorkflowStore). */
export interface ProjectInfoState {
  currentProjectId: string | null
  settings: { settings: ProjectSettingsDto | null }
  project: { info: ProjectSettingsDto | null }
}

/** Thông tin dự án đang mở có vai trò của tôi: bản ở Settings nếu đã tải, không thì bản tải lúc vào dự án. */
export function currentProjectInfo(state: ProjectInfoState): ProjectSettingsDto | null {
  const matches = (info: ProjectSettingsDto | null): info is ProjectSettingsDto =>
    info != null && (!state.currentProjectId || String(info.id) === String(state.currentProjectId))
  if (matches(state.settings.settings)) return state.settings.settings
  if (matches(state.project.info)) return state.project.info
  return null
}

/** Trạng thái dự án đang mở (DRAFT, ACTIVE...), chưa tải thì null. */
export function selectProjectStatus(state: ProjectInfoState): string | null {
  return currentProjectInfo(state)?.status ?? null
}

/** Người đang xem có bị khóa thao tác task vì dự án chưa chạy (Cộng tác viên/Viewer khi không ACTIVE). */
export function selectMemberWorkLocked(state: ProjectInfoState): boolean {
  const info = currentProjectInfo(state)
  return isMemberWorkLocked(info?.status, info?.myRole)
}
