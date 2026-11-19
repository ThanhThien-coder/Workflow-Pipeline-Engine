import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { workflowService } from '../services/container'
import type { ArtifactType, KanbanTask, TaskStatus, UserSummary } from '../types/kanban.types'
import type { MacroPhase } from '../types/workflow.types'
import { evaluateTransition } from '../domain/taskTransitions'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { ApiError } from '../services/http/ApiError'
import { phaseDisplayName } from '../utils/phaseName'

const SUCCESS_MESSAGES: Partial<Record<string, (code: string) => string>> = {
  'TODO>IN_PROGRESS': (code) => `Started task ${code}.`,
  'IN_PROGRESS>TODO': (code) => `Moved task ${code} back to To Do.`,
  'REVIEW>DONE': (code) => `Approved task ${code}: Marked as Done.`,
  'REVIEW>IN_PROGRESS': (code) => `Changes requested for ${code}: Moved back to In Progress.`,
}

export const STALE_TASK_MESSAGE = 'This task was changed by someone else. The board has been refreshed, please try again.'

/** Chỉ lỗi lệch version (backend: 409 OPTIMISTIC_LOCK_CONFLICT); 409 khác như PROJECT_ARCHIVED giữ câu báo của backend. */
function isStaleVersion(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.code === 'OPTIMISTIC_LOCK_CONFLICT'
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** Task vừa đổi cũng nằm trong My Tasks của người đang xem thì cập nhật luôn bản đó. */
function syncMyTasks(taskId: string, update: (task: KanbanTask) => KanbanTask): void {
  const { kanban } = useWorkflowStore.getState()
  if (!kanban.tasks.some((t) => t.id === taskId)) return
  useWorkflowStore.setState((state) => ({
    kanban: { ...state.kanban, tasks: state.kanban.tasks.map((t) => (t.id === taskId ? update(t) : t)) },
  }))
}

/**
 * Bảng Kanban của một phase: mọi task của phase lấy từ GET /projects/{id}/phases/{phaseId}/tasks
 * (kể cả task đang khóa và task chưa giao). Thành viên lấy từ dự án đang mở.
 * Tải lại khi đổi phase hoặc khi cây của phase đổi (sửa task, nối dây, đổi trạng thái đều đọc lại cây).
 */
export function usePhaseKanban(phase: MacroPhase | null | undefined, projectId: string | null) {
  // Người thao tác = người đang đăng nhập (sau F5 vẫn đúng); kanban.currentUserId chỉ là dự phòng cho chế độ mock
  const authUserId = useWorkflowStore((state) => state.auth.currentUser?.id)
  const kanbanUserId = useWorkflowStore((state) => state.kanban.currentUserId)
  const currentUserId = authUserId != null && String(authUserId) !== '' ? String(authUserId) : kanbanUserId
  const members = useWorkflowStore((state) => state.project.members)
  const storeToast = useWorkflowStore((state) => state.kanban.showToast)
  const resetPhaseTree = useWorkflowStore((state) => state.resetPhaseTree)
  const phaseTree = useWorkflowStore((state) => (phase?.id ? state.trees[phase.id] : undefined))

  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([])
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const requestRef = useRef(0)

  const phaseId = phase?.id ?? null
  const phaseLabel = phase ? phaseDisplayName(phase) : ''

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message)
      storeToast(message)
      window.setTimeout(() => setToastMessage((prev) => (prev === message ? null : prev)), 2600)
    },
    [storeToast]
  )

  const loadPhaseTasks = useCallback(async () => {
    const request = ++requestRef.current
    if (!projectId || !phaseId) {
      setTasks([])
      return
    }
    setLoading(true)
    try {
      const list = await workflowService.getPhaseTasks(projectId, phaseId)
      if (request !== requestRef.current) return
      setTasks(list.map((task) => ({ ...task, phaseLabel })))
    } catch (err) {
      if (request !== requestRef.current) return
      setTasks([])
      showToast(errorText(err, 'Could not load tasks for this phase.'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [projectId, phaseId, phaseLabel, showToast])

  useEffect(() => {
    void loadPhaseTasks()
  }, [loadPhaseTasks, phaseTree])

  /** Đổi trạng thái / nộp / giao xong: đọc lại cây (task con có thể vừa được mở khóa), Kanban tự tải lại theo cây. */
  const refreshAfterWrite = useCallback(async () => {
    if (phaseId) await resetPhaseTree(phaseId)
    else await loadPhaseTasks()
  }, [phaseId, resetPhaseTree, loadPhaseTasks])

  // Realtime: useProjectRealtime (gắn ở ProjectWorkspaceView) tải lại đồ thị khi có sự kiện; Kanban tự tải lại theo cây (phaseTree) nên không còn nghe SSE ở đây.

  // Người đang thao tác là người đăng nhập, không mượn quyền người khác
  const actor = useMemo<UserSummary | null>(
    () => members.find((m) => m.id === currentUserId) ?? null,
    [members, currentUserId]
  )

  const moveTask = useCallback(
    async (taskId: string, to: TaskStatus, rejectReason?: string) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || pendingTaskIds.includes(taskId)) return
      if (!actor) {
        showToast('You are not a member of this project, so you cannot change task status.')
        return
      }

      const decision = evaluateTransition(task, to, actor)
      if (decision.kind === 'deny') {
        if (decision.message) showToast(decision.message)
        return
      }
      if (decision.kind === 'needs-artifact') {
        setSubmittingTaskId(taskId)
        setIsSubmitModalOpen(true)
        return
      }
      // Trả task từ Review về In Progress: backend bắt buộc có lý do (board hỏi lý do trước khi gọi vào đây)
      if (task.status === 'REVIEW' && to === 'IN_PROGRESS' && !rejectReason?.trim()) {
        showToast('Please enter a reason for the requested changes.')
        return
      }

      const previous = task
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: to } : t)))
      setPendingTaskIds((prev) => [...prev, taskId])
      try {
        const saved = await workflowService.updateTaskStatus(taskId, to, rejectReason)
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...saved, phaseLabel } : t)))
        syncMyTasks(taskId, () => saved)
        const msgFn = SUCCESS_MESSAGES[`${previous.status}>${to}`]
        if (msgFn) showToast(msgFn(task.code))
        await refreshAfterWrite()
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)))
        if (isStaleVersion(err)) {
          await loadPhaseTasks()
          showToast(STALE_TASK_MESSAGE)
        } else {
          showToast(errorText(err, 'Unable to update status. Please try again.'))
        }
      } finally {
        setPendingTaskIds((prev) => prev.filter((id) => id !== taskId))
      }
    },
    [tasks, pendingTaskIds, actor, phaseLabel, showToast, refreshAfterWrite, loadPhaseTasks]
  )

  const submitArtifact = useCallback(
    async (taskId: string, form: { type: ArtifactType; url: string; note: string }): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return false

      setPendingTaskIds((prev) => [...prev, taskId])
      try {
        const result = await workflowService.submitTaskArtifact({ taskId, ...form })
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...result.task, phaseLabel } : t)))
        syncMyTasks(taskId, () => result.task)
        setIsSubmitModalOpen(false)
        setSubmittingTaskId(null)
        showToast(`Submitted ${task.code}: awaiting review.`)
        await refreshAfterWrite()
        return true
      } catch (err) {
        if (isStaleVersion(err)) {
          await loadPhaseTasks()
          showToast(STALE_TASK_MESSAGE)
        } else {
          showToast(errorText(err, 'Unable to submit deliverable. Please try again.'))
        }
        return false
      } finally {
        setPendingTaskIds((prev) => prev.filter((id) => id !== taskId))
      }
    },
    [tasks, phaseLabel, showToast, refreshAfterWrite, loadPhaseTasks]
  )

  const updateAssignment = useCallback(
    async (taskId: string, cmd: { assignedUserId?: string; dueDate?: string }): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId)
      try {
        const updated = await workflowService.updateTaskAssignment(taskId, { ...cmd, version: task?.version ?? 0 })
        const apply = (t: KanbanTask): KanbanTask => ({
          ...t,
          assignedUserId: updated.assignedUserId !== '' ? updated.assignedUserId : t.assignedUserId,
          dueDate: updated.dueDate !== '' ? updated.dueDate : t.dueDate,
          version: updated.version,
        })
        setTasks((prev) => prev.map((t) => (t.id === taskId ? apply(t) : t)))
        syncMyTasks(taskId, apply)
        showToast('Assignment updated')
        await refreshAfterWrite()
        return true
      } catch (err) {
        if (isStaleVersion(err)) {
          await loadPhaseTasks()
          showToast(STALE_TASK_MESSAGE)
        } else {
          showToast(errorText(err, 'Unable to update assignment. Please try again.'))
        }
        return false
      }
    },
    [tasks, showToast, refreshAfterWrite, loadPhaseTasks]
  )

  const submittingTask = useMemo(
    () => (submittingTaskId ? tasks.find((t) => t.id === submittingTaskId) ?? null : null),
    [tasks, submittingTaskId]
  )

  const openSubmitModal = useCallback((taskId: string) => {
    setSubmittingTaskId(taskId)
    setIsSubmitModalOpen(true)
  }, [])

  const closeSubmitModal = useCallback(() => {
    setIsSubmitModalOpen(false)
    setSubmittingTaskId(null)
  }, [])

  return {
    phaseTasks: tasks,
    members,
    actor,
    loading,
    pendingTaskIds,
    submittingTask,
    isSubmitModalOpen,
    toastMessage,
    moveTask,
    submitArtifact,
    openSubmitModal,
    closeSubmitModal,
    refreshTasks: loadPhaseTasks,
    updateAssignment,
  }
}
