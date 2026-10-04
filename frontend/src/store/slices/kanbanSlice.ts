import type { KanbanTask, PhaseFilterId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import { workflowService } from '../../services/container'
import { evaluateTransition } from '../../domain/taskTransitions'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export interface KanbanSlice {
  kanban: {
    members: UserSummary[]; tasks: KanbanTask[]; currentUserId: string; filterPhaseId: PhaseFilterId; searchQuery: string
    isSubmitModalOpen: boolean; submittingTaskId: string | null; pendingTaskIds: string[]; status: LoadStatus; error: string | null; toast: string | null
    loadMembers: (projectId: string) => Promise<void>; loadTasks: (projectId: string) => Promise<void>; setUserId: (projectId: string, userId: string) => Promise<void>
    setFilterPhase: (id: PhaseFilterId) => void; setSearchQuery: (query: string) => void; moveTask: (taskId: string, to: TaskStatus) => Promise<void>
    closeSubmitModal: () => void; submitArtifact: (dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>; showToast: (message: string) => void
  }
}
export const createKanbanSlice = (set: (update: (state: KanbanSlice) => KanbanSlice) => void, get: () => KanbanSlice): KanbanSlice => {
  const success: Partial<Record<string, (code: string) => string>> = {
    'TODO>IN_PROGRESS': (code) => `Bắt đầu làm ${code}.`, 'IN_PROGRESS>TODO': (code) => `Đã hủy nhận ${code}, trả về Chờ thực hiện.`, 'REVIEW>DONE': (code) => `Đã duyệt ${code}: chuyển sang Hoàn thành.`, 'REVIEW>IN_PROGRESS': (code) => `${code} bị trả lại để chỉnh sửa.`,
  }
  const k = () => get().kanban
  return { kanban: {
    members: [], tasks: [], currentUserId: '1', filterPhaseId: 'ALL', searchQuery: '', isSubmitModalOpen: false, submittingTaskId: null, pendingTaskIds: [], status: 'idle', error: null, toast: null,
    loadMembers: async (projectId) => { const members = await workflowService.getProjectMembers(projectId); set((state) => ({ ...state, kanban: { ...state.kanban, members } })) },
    loadTasks: async (projectId) => {
      set((state) => ({ ...state, kanban: { ...state.kanban, status: 'loading', error: null, tasks: [] } }))
      try { const tasks = await workflowService.getMyTasks(projectId, k().currentUserId); if (tasks.some((task) => task.assignedUserId !== k().currentUserId)) throw new Error('Dữ liệu task không thuộc người dùng hiện tại'); set((state) => ({ ...state, kanban: { ...state.kanban, tasks, status: 'ready' } })) }
      catch (error) { set((state) => ({ ...state, kanban: { ...state.kanban, status: 'error', error: error instanceof Error ? error.message : 'Không tải được task' } })) }
    },
    setUserId: async (projectId, userId) => { set((state) => ({ ...state, kanban: { ...state.kanban, currentUserId: userId, tasks: [], searchQuery: '', filterPhaseId: 'ALL', status: 'idle' } })); await get().kanban.loadTasks(projectId) },
    setFilterPhase: (filterPhaseId) => set((state) => ({ ...state, kanban: { ...state.kanban, filterPhaseId } })),
    setSearchQuery: (searchQuery) => set((state) => ({ ...state, kanban: { ...state.kanban, searchQuery } })),
    moveTask: async (taskId, to) => {
      const task = k().tasks.find((item) => item.id === taskId); const actor = k().members.find((member) => member.id === k().currentUserId)
      if (!task || !actor || k().pendingTaskIds.includes(taskId)) return
      const decision = evaluateTransition(task, to, actor)
      if (decision.kind === 'deny') { if (decision.message) k().showToast(decision.message); return }
      if (decision.kind === 'needs-artifact') { set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: true, submittingTaskId: taskId } })); return }
      const previous = task.status
      set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: to } : item), pendingTaskIds: [...state.kanban.pendingTaskIds, taskId] } }))
      try { const saved = await workflowService.updateTaskStatus(taskId, to); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? saved : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } })); const message = success[`${previous}>${to}`]; if (message) k().showToast(message(task.code)) }
      catch (error) { set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: previous } : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } })); k().showToast(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái. Vui lòng thử lại.') }
    },
    closeSubmitModal: () => set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: false, submittingTaskId: null } })),
    submitArtifact: async (form) => { const id = k().submittingTaskId; const task = k().tasks.find((item) => item.id === id); if (!id || !task) return false; try { const result = await workflowService.submitTaskArtifact({ taskId: id, ...form }); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === id ? result.task : item), isSubmitModalOpen: false, submittingTaskId: null } })); k().showToast(`Đã nộp ${task.code}: chờ Lead nghiệm thu.`); return true } catch (error) { k().showToast(error instanceof Error ? error.message : 'Không thể nộp kết quả. Vui lòng thử lại.'); return false } },
    showToast: (message) => { set((state) => ({ ...state, kanban: { ...state.kanban, toast: message } })); window.setTimeout(() => { if (get().kanban.toast === message) set((state) => ({ ...state, kanban: { ...state.kanban, toast: null } })) }, 2600) },
  } }
}
