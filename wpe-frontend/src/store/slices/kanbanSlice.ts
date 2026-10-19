import type { KanbanTask, PhaseFilterId, SubmitArtifactDto, TaskStatus, UserSummary } from '../../types/kanban.types'
import { workflowService } from '../../services/container'
import { evaluateTransition } from '../../domain/taskTransitions'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export interface KanbanSlice {
  kanban: {
    members: UserSummary[]; tasks: KanbanTask[]; currentUserId: string; filterPhaseId: PhaseFilterId; searchQuery: string
    isSubmitModalOpen: boolean; submittingTaskId: string | null; pendingTaskIds: string[]; status: LoadStatus; error: string | null; toast: string | null
    loadMembers: (projectId: string) => Promise<void>; loadTasks: (projectId: string) => Promise<void>; setUserId: (projectId: string, userId: string) => Promise<void>
    setFilterPhase: (id: PhaseFilterId) => void; setSearchQuery: (query: string) => void; moveTask: (taskId: string, to: TaskStatus, rejectReason?: string) => Promise<void>
    closeSubmitModal: () => void; submitArtifact: (dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>; submitTaskArtifact: (taskId: string, dto: Omit<SubmitArtifactDto, 'taskId'>) => Promise<boolean>; showToast: (message: string) => void
  }
}
export const createKanbanSlice = (set: (update: (state: KanbanSlice) => KanbanSlice) => void, get: () => KanbanSlice): KanbanSlice => {
  const success: Partial<Record<string, (code: string) => string>> = {
    'TODO>IN_PROGRESS': (code) => `Started work on ${code}.`,
    'IN_PROGRESS>TODO': (code) => `Reverted ${code} to To Do.`,
    'REVIEW>DONE': (code) => `Approved ${code}: marked as Done.`,
    'REVIEW>IN_PROGRESS': (code) => `Requested changes on ${code}: returned to In Progress.`,
  }
  const k = () => get().kanban
  return { kanban: {
    members: [], tasks: [], currentUserId: '1', filterPhaseId: 'ALL', searchQuery: '', isSubmitModalOpen: false, submittingTaskId: null, pendingTaskIds: [], status: 'idle', error: null, toast: null,
    loadMembers: async (projectId) => { const members = await workflowService.getProjectMembers(projectId); set((state) => ({ ...state, kanban: { ...state.kanban, members } })) },
    loadTasks: async (projectId) => {
      set((state) => ({ ...state, kanban: { ...state.kanban, status: 'loading', error: null, tasks: [] } }))
      try { const tasks = await workflowService.getMyTasks(projectId, k().currentUserId); if (tasks.some((task) => task.assignedUserId !== k().currentUserId)) throw new Error('Task data does not belong to current user'); set((state) => ({ ...state, kanban: { ...state.kanban, tasks, status: 'ready' } })) }
      catch (error) { set((state) => ({ ...state, kanban: { ...state.kanban, status: 'error', error: error instanceof Error ? error.message : 'Failed to load tasks' } })) }
    },
    setUserId: async (projectId, userId) => { set((state) => ({ ...state, kanban: { ...state.kanban, currentUserId: userId, tasks: [], searchQuery: '', filterPhaseId: 'ALL', status: 'idle' } })); await get().kanban.loadTasks(projectId) },
    setFilterPhase: (filterPhaseId) => set((state) => ({ ...state, kanban: { ...state.kanban, filterPhaseId } })),
    setSearchQuery: (searchQuery) => set((state) => ({ ...state, kanban: { ...state.kanban, searchQuery } })),
    moveTask: async (taskId, to, rejectReason) => {
      const task = k().tasks.find((item) => item.id === taskId);
      const isOwnerReviewAction = to === 'DONE' || (task?.status === 'REVIEW' && to === 'IN_PROGRESS');
      const actor = (isOwnerReviewAction ? k().members.find((m) => m.projectRole === 'OWNER') : null) ||
        k().members.find((member) => member.id === k().currentUserId) ||
        k().members[0];
      if (!task || !actor || k().pendingTaskIds.includes(taskId)) return
      const decision = evaluateTransition(task, to, actor)
      if (decision.kind === 'deny') { if (decision.message) k().showToast(decision.message); return }
      if (decision.kind === 'needs-artifact') { set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: true, submittingTaskId: taskId } })); return }
      const previous = task.status
      set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: to, rejectReason: to === 'IN_PROGRESS' ? rejectReason : undefined } : item), pendingTaskIds: [...state.kanban.pendingTaskIds, taskId] } }))
      try { const saved = await workflowService.updateTaskStatus(taskId, to, rejectReason); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? saved : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } })); const message = success[`${previous}>${to}`]; if (message) k().showToast(message(task.code)) }
      catch (error) { set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? { ...item, status: previous } : item), pendingTaskIds: state.kanban.pendingTaskIds.filter((id) => id !== taskId) } })); k().showToast(error instanceof Error ? error.message : 'Unable to update status. Please try again.') }
    },
    closeSubmitModal: () => set((state) => ({ ...state, kanban: { ...state.kanban, isSubmitModalOpen: false, submittingTaskId: null } })),
    submitArtifact: async (form) => { const id = k().submittingTaskId; const task = k().tasks.find((item) => item.id === id); if (!id || !task) return false; try { const result = await workflowService.submitTaskArtifact({ taskId: id, ...form }); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === id ? result.task : item), isSubmitModalOpen: false, submittingTaskId: null } })); k().showToast(`Submitted ${task.code}: awaiting Lead review.`); return true } catch (error) { k().showToast(error instanceof Error ? error.message : 'Unable to submit deliverable. Please try again.'); return false } },
    submitTaskArtifact: async (taskId, form) => { const task = k().tasks.find((item) => item.id === taskId); if (!task) return false; try { const result = await workflowService.submitTaskArtifact({ taskId, ...form }); set((state) => ({ ...state, kanban: { ...state.kanban, tasks: state.kanban.tasks.map((item) => item.id === taskId ? result.task : item), isSubmitModalOpen: false, submittingTaskId: null } })); k().showToast(`Submitted ${task.code}: awaiting Lead review.`); return true } catch (error) { k().showToast(error instanceof Error ? error.message : 'Unable to submit deliverable. Please try again.'); return false } },
    showToast: (message) => { set((state) => ({ ...state, kanban: { ...state.kanban, toast: message } })); window.setTimeout(() => { if (get().kanban.toast === message) set((state) => ({ ...state, kanban: { ...state.kanban, toast: null } })) }, 2600) },
  } }
}
