import type { KanbanTask, PhaseFilterId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import { workflowService } from '../../services/container'
import { getStoredUserId } from '../../services/http/apiClient'
import { ApiError } from '../../services/http/ApiError'
import { phaseDisplayName } from '../../utils/phaseName'
import { evaluateTransition } from '../../domain/taskTransitions'
import { selectProjectStatus, type ProjectInfoState } from '../projectInfo'
import type { ArtifactsSlice } from './artifactsSlice'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export const STALE_TASK_MESSAGE = 'This task was changed by someone else. The board has been refreshed, please try again.'
export interface KanbanSlice {
  kanban: {
    members: UserSummary[]; tasks: KanbanTask[]; currentUserId: string; filterPhaseId: PhaseFilterId; searchQuery: string
    isSubmitModalOpen: boolean; submittingTaskId: string | null; pendingTaskIds: string[]; status: LoadStatus; error: string | null; toast: string | null
    /** G18: hàng chờ duyệt của dự án (mọi task REVIEW), chỉ tải cho chủ dự án / quản lý. */
    reviewTasks: KanbanTask[]; reviewStatus: LoadStatus
    loadReviewTasks: (projectId: string) => Promise<void>
    /** G18: duyệt (DONE) hoặc trả lại (IN_PROGRESS kèm lý do) một task trong hàng chờ duyệt. */
    reviewTask: (taskId: string, to: 'DONE' | 'IN_PROGRESS', rejectReason?: string) => Promise<void>
    loadMembers: (projectId: string) => Promise<void>; loadTasks: (projectId: string) => Promise<void>; setUserId: (projectId: string, userId: string) => Promise<void>
    setFilterPhase: (id: PhaseFilterId) => void; setSearchQuery: (query: string) => void; moveTask: (taskId: string, to: TaskStatus, rejectReason?: string) => Promise<void>
    /** S04: mở lại task Done của My Tasks (chủ dự án / quản lý, bắt buộc lý do). */
    reopenTask: (taskId: string, reason: string) => Promise<boolean>
    closeSubmitModal: () => void; submitArtifact: (dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>; submitTaskArtifact: (taskId: string, dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>; showToast: (message: string) => void
  }
}
// get() là cả store: slice artifacts (nếu có) được tải lại sau khi nộp minh chứng (G17)
export const createKanbanSlice = (set: (update: (state: KanbanSlice) => KanbanSlice) => void, get: () => KanbanSlice & Partial<ArtifactsSlice>): KanbanSlice => {
  const success: Partial<Record<string, (code: string) => string>> = {
    'TODO>IN_PROGRESS': (code) => `Started work on ${code}.`,
    'IN_PROGRESS>TODO': (code) => `Reverted ${code} to To Do.`,
    'REVIEW>DONE': (code) => `Approved ${code}: marked as Done.`,
    'REVIEW>IN_PROGRESS': (code) => `Requested changes on ${code}: returned to In Progress.`,
  }
  const k = () => get().kanban
  // G17: nộp minh chứng xong thì kho Artifacts của dự án đang mở có thêm link mới: tải lại (lỗi tải đã do slice artifacts tự hiện)
  const refreshArtifacts = () => { const artifacts = get().artifacts; if (artifacts?.projectId) void artifacts.loadArtifacts(artifacts.projectId).catch(() => {}) }
  return { kanban: {
    members: [], tasks: [], currentUserId: getStoredUserId() ?? '1', filterPhaseId: 'ALL', searchQuery: '', isSubmitModalOpen: false, submittingTaskId: null, pendingTaskIds: [], status: 'idle', error: null, toast: null, reviewTasks: [], reviewStatus: 'idle',
    loadMembers: async (projectId) => { const members = await workflowService.getProjectMembers(projectId); set((state) => ({ ...state, kanban: { ...state.kanban, members } })) },
    loadTasks: async (projectId) => {
      set((state) => ({ ...state, kanban: { ...state.kanban, status: 'loading', error: null, tasks: [] } }))
      try {
        const [loaded, phases] = await Promise.all([
          workflowService.getMyTasks(projectId, k().currentUserId),
          // Tên phase chỉ để hiển thị: không tải được thì vẫn hiện task với nhãn sẵn có
          workflowService.getMacroPhases(projectId).catch(() => []),
        ])
        if (loaded.some((task) => task.assignedUserId !== k().currentUserId)) throw new Error('Task data does not belong to current user')
        const phaseLabels = new Map(phases.map((phase) => [phase.id, phaseDisplayName(phase)]))
        const tasks = loaded.map((task) => ({ ...task, phaseLabel: phaseLabels.get(task.phaseId) ?? task.phaseLabel }))
        set((state) => ({ ...state, kanban: { ...state.kanban, tasks, status: 'ready' } }))
      }
      catch (error) { set((state) => ({ ...state, kanban: { ...state.kanban, status: 'error', error: error instanceof Error ? error.message : 'Failed to load tasks' } })) }
    },
    setUserId: async (projectId, userId) => { set((state) => ({ ...state, kanban: { ...state.kanban, currentUserId: userId, tasks: [], searchQuery: '', filterPhaseId: 'ALL', status: 'idle' } })); await get().kanban.loadTasks(projectId) },
    setFilterPhase: (filterPhaseId) => set((state) => ({ ...state, kanban: { ...state.kanban, filterPhaseId } })),
    setSearchQuery: (searchQuery) => set((state) => ({ ...state, kanban: { ...state.kanban, searchQuery } })),
    moveTask: async (taskId, to, rejectReason) => {
      const task = k().tasks.find((item) => item.id === taskId);
      // Người thao tác là người đang đăng nhập, không mượn quyền người khác
      const actor = k().members.find((member) => member.id === k().currentUserId);
      if (!task || !actor || k().pendingTaskIds.includes(taskId)) return
      const decision = evaluateTransition(task, to, actor, selectProjectStatus(get() as unknown as ProjectInfoState))
      if (decision.kind === 'deny') { if (decision.message) k().showToast(decision.message); return }
      if (decision.kind === 'needs-artifact') { set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: true, submittingTaskId: taskId } })); return }
      // Trả task từ Review về In Progress: backend bắt buộc có lý do (UI hỏi lý do trước khi gọi vào đây)
      if (task.status === 'REVIEW' && to === 'IN_PROGRESS' && !rejectReason?.trim()) { k().showToast('Please enter a reason for the requested changes.'); return }
      const previous = task.status
      set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: to, rejectReason: to === 'IN_PROGRESS' ? rejectReason : undefined } : item), pendingTaskIds: [...state.kanban.pendingTaskIds, taskId] } }))
      try { const saved = await workflowService.updateTaskStatus(taskId, to, rejectReason); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...saved, phaseLabel: item.phaseLabel } : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } })); const message = success[`${previous}>${to}`]; if (message) k().showToast(message(task.code)) }
      catch (error) {
        set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: previous } : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } }))
        // Chỉ lỗi lệch version; 409 khác (PROJECT_ARCHIVED...) giữ câu báo của backend
        if (error instanceof ApiError && error.status === 409 && error.code === 'OPTIMISTIC_LOCK_CONFLICT') {
          // Task đã bị người khác đổi: tải lại danh sách rồi báo
          const projectId = (get() as unknown as { currentProjectId?: string | null }).currentProjectId ?? get().artifacts?.projectId
          if (projectId) await k().loadTasks(String(projectId)).catch(() => {})
          k().showToast(STALE_TASK_MESSAGE)
          return
        }
        k().showToast(error instanceof Error ? error.message : 'Unable to update status. Please try again.')
      }
    },
    loadReviewTasks: async (projectId) => {
      set((state) => ({ ...state, kanban: { ...state.kanban, reviewStatus: 'loading' } }))
      try {
        const [loaded, phases] = await Promise.all([
          workflowService.getReviewTasks(projectId),
          workflowService.getMacroPhases(projectId).catch(() => []),
        ])
        const phaseLabels = new Map(phases.map((phase) => [phase.id, phaseDisplayName(phase)]))
        const reviewTasks = loaded.map((task) => ({ ...task, phaseLabel: phaseLabels.get(task.phaseId) ?? task.phaseLabel }))
        set((state) => ({ ...state, kanban: { ...state.kanban, reviewTasks, reviewStatus: 'ready' } }))
      } catch {
        set((state) => ({ ...state, kanban: { ...state.kanban, reviewTasks: [], reviewStatus: 'error' } }))
      }
    },
    reviewTask: async (taskId, to, rejectReason) => {
      const task = k().reviewTasks.find((item) => item.id === taskId)
      if (!task || k().pendingTaskIds.includes(taskId)) return
      if (to === 'IN_PROGRESS' && !rejectReason?.trim()) { k().showToast('Please enter a reason for the requested changes.'); return }
      set((state) => ({ ...state, kanban: { ...state.kanban, pendingTaskIds: [...state.kanban.pendingTaskIds, taskId] } }))
      try {
        const saved = await workflowService.updateTaskStatus(taskId, to, rejectReason)
        // Rời hàng chờ duyệt; nếu task cũng nằm trong My Tasks (task của chính mình) thì cập nhật luôn
        set((state) => ({ ...state, kanban: { ...state.kanban,
          reviewTasks: state.kanban.reviewTasks.filter((item) => item.id !== taskId),
          tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...saved, phaseLabel: item.phaseLabel } : item),
        } }))
        k().showToast(success[`REVIEW>${to}`]?.(task.code) ?? `Updated ${task.code}.`)
      } catch (error) {
        k().showToast(error instanceof Error ? error.message : 'Unable to update status. Please try again.')
      } finally {
        set((state) => ({ ...state, kanban: { ...state.kanban, pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } }))
      }
    },
    reopenTask: async (taskId, reason) => {
      const task = k().tasks.find((item) => item.id === taskId)
      if (!task || !workflowService.reopenTask || k().pendingTaskIds.includes(taskId)) return false
      set((state) => ({ ...state, kanban: { ...state.kanban, pendingTaskIds: [...state.kanban.pendingTaskIds, taskId] } }))
      try {
        const saved = await workflowService.reopenTask(taskId, reason)
        set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...saved, phaseLabel: item.phaseLabel } : item) } }))
        k().showToast(`Reopened ${task.code}: moved back to In Progress.`)
        // Task con của chính mình có thể vừa bị khóa lại: tải lại danh sách ngầm (không xóa list, không nháy).
        // Sự kiện realtime của chính tab này bị bỏ qua nên phải tự làm ở đây.
        const projectId = (get() as unknown as { currentProjectId?: string | null }).currentProjectId ?? get().artifacts?.projectId
        if (projectId) {
          try {
            const fresh = await workflowService.getMyTasks(String(projectId), k().currentUserId)
            set((state) => {
              const labels = new Map(state.kanban.tasks.map((item) => [item.id, item.phaseLabel]))
              return { ...state, kanban: { ...state.kanban, tasks: fresh.map((item) => ({ ...item, phaseLabel: labels.get(item.id) ?? item.phaseLabel })) } }
            })
          } catch { /* giữ danh sách hiện có; lần tải sau sẽ đúng */ }
        }
        return true
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && error.code === 'OPTIMISTIC_LOCK_CONFLICT') {
          const projectId = (get() as unknown as { currentProjectId?: string | null }).currentProjectId ?? get().artifacts?.projectId
          if (projectId) await k().loadTasks(String(projectId)).catch(() => {})
          k().showToast(STALE_TASK_MESSAGE)
        } else {
          k().showToast(error instanceof Error ? error.message : 'Unable to reopen the task. Please try again.')
        }
        return false
      } finally {
        set((state) => ({ ...state, kanban: { ...state.kanban, pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } }))
      }
    },
    closeSubmitModal: () => set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: false, submittingTaskId: null } })),
    submitArtifact: async (form) => { const id = k().submittingTaskId; const task = k().tasks.find((item) => item.id === id); if (!id || !task) return false; try { const result = await workflowService.submitTaskArtifact({ taskId: id, ...form }); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === id ? { ...result.task, phaseLabel: item.phaseLabel } : item), isSubmitModalOpen: false, submittingTaskId: null } })); k().showToast(`Submitted ${task.code}: awaiting Lead review.`); refreshArtifacts(); return true } catch (error) { k().showToast(error instanceof Error ? error.message : 'Unable to submit deliverable. Please try again.'); return false } },
    submitTaskArtifact: async (taskId, form) => { const task = k().tasks.find((item) => item.id === taskId); if (!task) return false; try { const result = await workflowService.submitTaskArtifact({ taskId, ...form }); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...result.task, phaseLabel: item.phaseLabel } : item), isSubmitModalOpen: false, submittingTaskId: null } })); k().showToast(`Submitted ${task.code}: awaiting Lead review.`); refreshArtifacts(); return true } catch (error) { k().showToast(error instanceof Error ? error.message : 'Unable to submit deliverable. Please try again.'); return false } },
    showToast: (message) => { set((state) => ({ ...state, kanban: { ...state.kanban, toast: message } })); window.setTimeout(() => { if (get().kanban.toast === message) set((state) => ({ ...state, kanban: { ...state.kanban, toast: null } })) }, 2600) },
  } }
}
