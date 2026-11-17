import type { KanbanTask, TaskStatus, TransitionDecision, UserSummary } from '../types/kanban.types'

export function evaluateTransition(task: Pick<KanbanTask, 'status' | 'assignedUserId'>, to: TaskStatus, actor: Pick<UserSummary, 'id' | 'projectRole'>): TransitionDecision {
  const from = task.status
  const canReview = actor.projectRole === 'OWNER' || actor.projectRole === 'MANAGER'
  if (from === to) return { kind: 'deny', message: '' }
  if (from === 'DONE') return { kind: 'deny', message: 'This task is Done and locked, so it can\'t be changed.' }
  // Mở khóa chỉ do backend làm (đủ điều kiện task trước, hoặc chủ dự án mở khóa sớm); không kéo vào/ra cột Đang khóa
  if (from === 'LOCKED') return { kind: 'deny', message: 'This task is locked: its prerequisites must be done first (or the project owner can unlock it early).' }
  if (to === 'LOCKED') return { kind: 'deny', message: 'A task cannot be moved back to Locked.' }

  // Owner or Manager review actions (Approve to DONE or Reject back to IN_PROGRESS) can be performed on any member's task
  const isReviewAction = canReview && (to === 'DONE' || (from === 'REVIEW' && to === 'IN_PROGRESS'))
  if (task.assignedUserId !== actor.id && !isReviewAction) {
    return { kind: 'deny', message: 'You can only update your own tasks.' }
  }

  if (to === 'DONE') {
    if (!canReview) return { kind: 'deny', message: 'Only the project owner or a manager can approve a task as Done.' }
    return from === 'REVIEW' ? { kind: 'allow' } : { kind: 'deny', message: 'A task must go through Review before it can be accepted.' }
  }
  switch (`${from}>${to}`) {
    case 'TODO>IN_PROGRESS': return { kind: 'allow' }
    case 'IN_PROGRESS>TODO': return { kind: 'allow' }
    case 'IN_PROGRESS>REVIEW': return { kind: 'needs-artifact' }
    case 'TODO>REVIEW': return { kind: 'deny', message: 'Start working on the task before submitting your work.' }
    case 'REVIEW>IN_PROGRESS': return canReview ? { kind: 'allow' } : { kind: 'deny', message: 'Only the project owner or a manager can send a task in review back for rework.' }
    case 'REVIEW>TODO': return { kind: 'deny', message: 'A task in review can\'t be moved back to To do.' }
    default: return { kind: 'deny', message: 'This status change isn\'t allowed.' }
  }
}
