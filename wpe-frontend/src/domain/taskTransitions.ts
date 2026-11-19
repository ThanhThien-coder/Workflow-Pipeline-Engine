import type { KanbanTask, TaskStatus, TransitionDecision, UserSummary } from '../types/kanban.types'
import { isMemberWorkLocked, memberWorkLockedMessage } from './projectWork'

export function evaluateTransition(task: Pick<KanbanTask, 'status' | 'assignedUserId'>, to: TaskStatus, actor: Pick<UserSummary, 'id' | 'projectRole'>, projectStatus?: string | null): TransitionDecision {
  const from = task.status
  const canReview = actor.projectRole === 'OWNER' || actor.projectRole === 'MANAGER'
  if (from === to) return { kind: 'deny', message: '' }
  // Dự án chưa chạy (không ACTIVE): Cộng tác viên chỉ xem; chủ dự án và Quản lý làm bình thường
  if (isMemberWorkLocked(projectStatus, actor.projectRole)) return { kind: 'deny', message: memberWorkLockedMessage(projectStatus) }
  if (from === 'DONE') return { kind: 'deny', message: 'This task is Done. Use “Reopen task” in its details to reopen it.' }
  // Mở khóa chỉ do backend làm (đủ điều kiện task trước, hoặc chủ dự án mở khóa sớm); không kéo vào/ra cột Đang khóa
  if (from === 'LOCKED') return { kind: 'deny', message: 'This task is locked: its prerequisites must be done first (or the project owner can unlock it early).' }
  if (to === 'LOCKED') return { kind: 'deny', message: 'A task cannot be moved back to Locked.' }

  // Luật theo StateMachineService.updateStatus của backend:
  // - Duyệt (REVIEW -> DONE) và trả lại (REVIEW -> IN_PROGRESS): Owner hoặc Manager, task của bất kỳ ai.
  // - Bắt đầu / bỏ nhận / nộp (TODO <-> IN_PROGRESS, IN_PROGRESS -> REVIEW): người được giao hoặc Owner (kể cả task chưa giao).
  const isOwner = actor.projectRole === 'OWNER'
  const isAssignee = Boolean(task.assignedUserId) && task.assignedUserId === actor.id
  const canWork = isAssignee || isOwner
  const denyNotYours: TransitionDecision = { kind: 'deny', message: 'You can only update your own tasks (the project owner can update any task).' }

  if (to === 'DONE') {
    if (from !== 'REVIEW') return { kind: 'deny', message: 'A task must go through Review before it can be accepted.' }
    return canReview ? { kind: 'allow' } : { kind: 'deny', message: 'Only the project owner or a manager can approve a task as Done.' }
  }
  switch (`${from}>${to}`) {
    case 'TODO>IN_PROGRESS': return canWork ? { kind: 'allow' } : denyNotYours
    case 'IN_PROGRESS>TODO': return canWork ? { kind: 'allow' } : denyNotYours
    case 'IN_PROGRESS>REVIEW': return canWork ? { kind: 'needs-artifact' } : denyNotYours
    case 'TODO>REVIEW': return { kind: 'deny', message: 'Start working on the task before submitting your work.' }
    case 'REVIEW>IN_PROGRESS': return canReview ? { kind: 'allow' } : { kind: 'deny', message: 'Only the project owner or a manager can send a task in review back for rework.' }
    case 'REVIEW>TODO': return { kind: 'deny', message: 'A task in review can\'t be moved back to To do.' }
    default: return { kind: 'deny', message: 'This status change isn\'t allowed.' }
  }
}
