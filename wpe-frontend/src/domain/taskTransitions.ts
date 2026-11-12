import type { KanbanTask, TaskStatus, TransitionDecision, UserSummary } from '../types/kanban.types'

export function evaluateTransition(task: Pick<KanbanTask, 'status' | 'assignedUserId'>, to: TaskStatus, actor: Pick<UserSummary, 'id' | 'projectRole'>): TransitionDecision {
  const from = task.status
  const canReview = actor.projectRole === 'OWNER' || actor.projectRole === 'MANAGER'
  if (from === to) return { kind: 'deny', message: '' }
  if (from === 'DONE') return { kind: 'deny', message: 'Task đã DONE nên bị đóng băng, không thể thay đổi.' }

  // Owner or Manager review actions (Approve to DONE or Reject back to IN_PROGRESS) can be performed on any member's task
  const isReviewAction = canReview && (to === 'DONE' || (from === 'REVIEW' && to === 'IN_PROGRESS'))
  if (task.assignedUserId !== actor.id && !isReviewAction) {
    return { kind: 'deny', message: 'Bạn chỉ thao tác được trên task của mình.' }
  }

  if (to === 'DONE') {
    if (!canReview) return { kind: 'deny', message: 'Chỉ Owner hoặc Quản lý mới có quyền duyệt sang DONE (Strict Review Constraint).' }
    return from === 'REVIEW' ? { kind: 'allow' } : { kind: 'deny', message: 'Task phải qua bước Chờ duyệt trước khi được nghiệm thu.' }
  }
  switch (`${from}>${to}`) {
    case 'TODO>IN_PROGRESS': return { kind: 'allow' }
    case 'IN_PROGRESS>TODO': return { kind: 'allow' }
    case 'IN_PROGRESS>REVIEW': return { kind: 'needs-artifact' }
    case 'TODO>REVIEW': return { kind: 'deny', message: 'Cần bắt đầu làm trước khi nộp kết quả.' }
    case 'REVIEW>IN_PROGRESS': return canReview ? { kind: 'allow' } : { kind: 'deny', message: 'Chỉ Owner hoặc Quản lý mới có thể yêu cầu làm lại task đang chờ duyệt.' }
    case 'REVIEW>TODO': return { kind: 'deny', message: 'Không thể trả task đang chờ duyệt về Chờ thực hiện.' }
    default: return { kind: 'deny', message: 'Chuyển trạng thái không hợp lệ.' }
  }
}
