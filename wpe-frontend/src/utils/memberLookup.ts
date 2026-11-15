import type { UserSummary } from '../types/kanban.types'

/**
 * Tìm thành viên theo người làm của node. Chế độ API lưu id người dùng; dữ liệu mock cũ lưu tên,
 * nên khớp theo id trước rồi mới theo tên.
 */
export function findMember(members: readonly UserSummary[], assignee: string | null | undefined): UserSummary | undefined {
  if (!assignee) return undefined
  return members.find((m) => m.id === assignee) ?? members.find((m) => m.name === assignee)
}
