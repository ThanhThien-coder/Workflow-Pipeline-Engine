import { useEffect, useMemo, useState } from 'react'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { UserSwitcher } from '../components/kanban/UserSwitcher'
import { KanbanToolbar } from '../components/kanban/KanbanToolbar'
import { KanbanBoard } from '../components/kanban/KanbanBoard'
import { SubmitArtifactModal } from '../components/kanban/SubmitArtifactModal'
import { TaskDetailModal } from '../components/kanban/TaskDetailModal'

export function MyTasksView() {
  const members = useWorkflowStore((state) => state.kanban.members)
  const tasks = useWorkflowStore((state) => state.kanban.tasks)
  const userId = useWorkflowStore((state) => state.kanban.currentUserId)
  const phase = useWorkflowStore((state) => state.kanban.filterPhaseId)
  const query = useWorkflowStore((state) => state.kanban.searchQuery)
  const status = useWorkflowStore((state) => state.kanban.status)
  const error = useWorkflowStore((state) => state.kanban.error)
  const toast = useWorkflowStore((state) => state.kanban.toast)
  const modal = useWorkflowStore((state) => state.kanban.isSubmitModalOpen)
  const submittingId = useWorkflowStore((state) => state.kanban.submittingTaskId)
  const pending = useWorkflowStore((state) => state.kanban.pendingTaskIds)

  const loadMembers = useWorkflowStore((state) => state.kanban.loadMembers)
  const loadTasks = useWorkflowStore((state) => state.kanban.loadTasks)
  const setUserId = useWorkflowStore((state) => state.kanban.setUserId)
  const setPhase = useWorkflowStore((state) => state.kanban.setFilterPhase)
  const setQuery = useWorkflowStore((state) => state.kanban.setSearchQuery)
  const moveTask = useWorkflowStore((state) => state.kanban.moveTask)
  const closeModal = useWorkflowStore((state) => state.kanban.closeSubmitModal)
  const submitArtifact = useWorkflowStore((state) => state.kanban.submitArtifact)
  const submitTaskArtifact = useWorkflowStore((state) => state.kanban.submitTaskArtifact)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    void loadMembers('1')
  }, [loadMembers])

  useEffect(() => {
    if (status === 'idle') void loadTasks('1')
  }, [loadTasks, status])

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return tasks.filter(
      (task) =>
        (phase === 'ALL' || task.phaseId === phase) &&
        (!keyword ||
          task.title.toLowerCase().includes(keyword) ||
          task.code.toLowerCase().includes(keyword)),
    )
  }, [tasks, phase, query])

  const actor = members.find((member) => member.id === userId)
  const submittingTask = tasks.find((task) => task.id === submittingId)
  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((item) => item.id === selectedTaskId) || null : null),
    [tasks, selectedTaskId],
  )

  if (status === 'loading' && !tasks.length) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-sm text-slate-500">
        Loading My Tasks…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (!actor) return null

  return (
    <div className="flex h-full flex-col space-y-3 overflow-hidden bg-slate-50 px-6 py-3.5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">My Tasks</h1>
          <p className="mt-0.5 text-xs text-slate-500">Personal Kanban Board · Marketing Q4</p>
        </div>
        <UserSwitcher
          members={members}
          currentUserId={userId}
          onSelect={(id) => void setUserId('1', id)}
        />
      </div>

      {/* Toolbar */}
      <KanbanToolbar
        query={query}
        phase={phase}
        tasks={tasks}
        onQuery={setQuery}
        onPhase={setPhase}
      />

      {/* Board */}
      <KanbanBoard
        tasks={visible}
        actor={actor}
        pendingIds={pending}
        onMove={(id, to) => void moveTask(id, to)}
        filtering={Boolean(query || phase !== 'ALL')}
        onOpenDetails={(task) => setSelectedTaskId(task.id)}
      />

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          actor={actor}
          members={members}
          pending={pending.includes(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
          onMove={(to, rejectReason) => void moveTask(selectedTask.id, to, rejectReason)}
          onSubmitArtifact={(dto) => submitTaskArtifact(selectedTask.id, dto)}
        />
      )}

      {/* Submit Artifact Modal (when triggered by transition) */}
      {modal && submittingTask && (
        <SubmitArtifactModal
          task={submittingTask}
          submitting={pending.includes(submittingTask.id)}
          onClose={closeModal}
          onSubmit={submitArtifact}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
