import { useCallback, useEffect, useMemo, useState } from 'react'
import { workflowService } from '../services/container'
import type {
  ArtifactType,
  KanbanTask,
  PhaseId,
  TaskStatus,
  UserSummary,
} from '../types/kanban.types'
import type { MacroPhase, BranchGraphNode } from '../types/workflow.types'
import { isTaskInPhase } from '../utils/phaseTaskMatcher'
import { evaluateTransition } from '../domain/taskTransitions'
import { useWorkflowStore } from '../store/useWorkflowStore'

const SUCCESS_MESSAGES: Partial<Record<string, (code: string) => string>> = {
  'TODO>IN_PROGRESS': (code) => `Started task ${code}.`,
  'IN_PROGRESS>TODO': (code) => `Moved task ${code} back to To Do.`,
  'REVIEW>DONE': (code) => `Approved task ${code}: Marked as Done.`,
  'REVIEW>IN_PROGRESS': (code) => `Changes requested for ${code}: Moved back to In Progress.`,
}

export function usePhaseKanban(
  phase: MacroPhase | null | undefined,
  projectId = '1'
) {
  const currentUserId = useWorkflowStore((state) => state.kanban.currentUserId)
  const storeMembers = useWorkflowStore((state) => state.kanban.members)
  const storeToast = useWorkflowStore((state) => state.kanban.showToast)

  const [allTasks, setAllTasks] = useState<KanbanTask[]>([])
  const [members, setMembers] = useState<UserSummary[]>(storeMembers)
  const [loading, setLoading] = useState(false)
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([])
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message)
      storeToast(message)
      window.setTimeout(() => {
        setToastMessage((prev) => (prev === message ? null : prev))
      }, 2600)
    },
    [storeToast]
  )

  // 1. Load project members and all tasks across all users
  const loadProjectTasks = useCallback(async () => {
    setLoading(true)
    try {
      let activeMembers = storeMembers
      if (!activeMembers.length) {
        activeMembers = await workflowService.getProjectMembers(projectId)
        setMembers(activeMembers)
      } else {
        setMembers(activeMembers)
      }

      // Fetch tasks for each member in parallel
      const tasksPerMember = await Promise.all(
        activeMembers.map((member) =>
          workflowService.getMyTasks(projectId, member.id)
        )
      )

      setAllTasks(tasksPerMember.flat())
    } catch (err) {
      console.error('Failed to load phase tasks:', err)
      showToast('Failed to load phase tasks.')
    } finally {
      setLoading(false)
    }
  }, [projectId, storeMembers, showToast])

  useEffect(() => {
    void loadProjectTasks()
  }, [loadProjectTasks])

  // 2. Identify the active actor (current user or project Owner)
  const actor = useMemo<UserSummary>(() => {
    const found = members.find((m) => m.id === currentUserId)
    if (found) return found
    const owner = members.find((m) => m.projectRole === 'OWNER')
    if (owner) return owner
    return {
      id: currentUserId || '1',
      name: 'Alex Kim',
      roleTitle: 'Project Lead / Owner',
      initials: 'AK',
      avatarClass: 'bg-emerald-500',
      projectRole: 'OWNER',
      assignedTaskCount: 17,
    }
  }, [members, currentUserId])

  const phaseTree = useWorkflowStore((state) =>
    phase?.id ? state.trees[phase.id] : undefined
  )

  // 3. Filter all tasks belonging to the current phase and sync with graph tree nodes
  const phaseTasks = useMemo(() => {
    if (!phase) return []
    const apiTasks = allTasks.filter((task) => isTaskInPhase(task, phase))

    if (!phaseTree) return apiTasks

    const mappedApiTasks = apiTasks.map((task) => {
      const matching = Object.values(phaseTree).find(
        (n): n is BranchGraphNode =>
          n.kind === 'branch' &&
          (n.id === task.id ||
            Boolean(n.code && task.code && n.code.toUpperCase() === task.code.toUpperCase()))
      )
      if (!matching) return task

      const taskStatus: TaskStatus =
        matching.status === 'LOCKED' ? 'TODO' : (matching.status as TaskStatus)

      let assignedUserId = task.assignedUserId
      if (matching.assignee) {
        if (matching.assignee.includes('Sarah')) assignedUserId = '2'
        else if (matching.assignee.includes('Marcus')) assignedUserId = '3'
        else if (matching.assignee.includes('Jamie')) assignedUserId = '4'
        else if (matching.assignee.includes('Alex')) assignedUserId = '1'
      }

      return {
        ...task,
        title: matching.title || task.title,
        status: taskStatus,
        assignedUserId,
        description: matching.description !== undefined ? matching.description : task.description,
        dueDate: matching.due ? `${matching.due}T23:59:59+07:00` : task.dueDate,
        joinPolicySummary: matching.joinPolicy ? `${matching.joinPolicy}-Join` : task.joinPolicySummary,
      }
    })

    const existingIds = new Set(mappedApiTasks.map((t) => t.id))
    const existingCodes = new Set(
      mappedApiTasks.map((t) => (t.code ? t.code.toUpperCase() : ''))
    )

    const treeTasks: KanbanTask[] = []
    Object.values(phaseTree).forEach((node) => {
      if (node.kind === 'branch' && !(node as BranchGraphNode).isTrack) {
        const branch = node as BranchGraphNode
        const codeUpper = (branch.code || '').toUpperCase()

        if (!existingIds.has(branch.id) && (!codeUpper || !existingCodes.has(codeUpper))) {
          const taskStatus: TaskStatus =
            branch.status === 'LOCKED' ? 'TODO' : (branch.status as TaskStatus)

          treeTasks.push({
            id: branch.id,
            code: branch.code || `WPE-${Math.floor(100 + Math.random() * 900)}`,
            title: branch.title || 'New Task Node',
            description: branch.description || '',
            status: taskStatus,
            assignedUserId: branch.assignee
              ? branch.assignee.includes('Sarah')
                ? '2'
                : branch.assignee.includes('Marcus')
                ? '3'
                : branch.assignee.includes('Jamie')
                ? '4'
                : '1'
              : '1',
            phaseId: ((phase.id || 'P2A').toUpperCase() as PhaseId) || 'P2A',
            phaseLabel: `${phase.name} · ${phase.sub}`,
            dueDate: branch.due
              ? `${branch.due}T23:59:59+07:00`
              : new Date(Date.now() + 7 * 86400000).toISOString(),
            isOverdue: false,
            joinPolicySummary: branch.joinPolicy ? `${branch.joinPolicy}-Join` : '',
            artifacts: [],
            version: 0,
          })
        }
      }
    })

    return [...mappedApiTasks, ...treeTasks]
  }, [allTasks, phase, phaseTree])

  // 4. Moving a task between columns
  const moveTask = useCallback(
    async (taskId: string, to: TaskStatus, rejectReason?: string) => {
      const task = phaseTasks.find((t) => t.id === taskId)
      if (!task || pendingTaskIds.includes(taskId)) return

      // Determine the acting user for transition validation
      const taskAssignee = members.find((m) => m.id === task.assignedUserId) || actor
      const effectiveActor = (actor.projectRole === 'OWNER' || actor.projectRole === 'MANAGER') ? actor : taskAssignee

      const decision = evaluateTransition(task, to, effectiveActor)
      if (decision.kind === 'deny') {
        if (decision.message) showToast(decision.message)
        return
      }
      if (decision.kind === 'needs-artifact') {
        setSubmittingTaskId(taskId)
        setIsSubmitModalOpen(true)
        return
      }

      const previousStatus = task.status

      // Optimistic update
      setAllTasks((prev) => {
        const exists = prev.some((t) => t.id === taskId)
        if (exists) {
          return prev.map((t) => (t.id === taskId ? { ...t, status: to, rejectReason: to === 'IN_PROGRESS' ? rejectReason : undefined } : t))
        }
        return [...prev, { ...task, status: to, rejectReason: to === 'IN_PROGRESS' ? rejectReason : undefined }]
      })
      setPendingTaskIds((prev) => [...prev, taskId])

      // Also update node status in graph tree if this is a graph node
      if (phase && phaseTree && phaseTree[taskId]) {
        useWorkflowStore.getState().updateTree(phase.id, (nodes) => {
          if (!nodes[taskId] || nodes[taskId].kind !== 'branch') return nodes
          return {
            ...nodes,
            [taskId]: {
              ...nodes[taskId],
              status: to,
            },
          }
        })
      }

      try {
        const isSeededTask = allTasks.some((t) => t.id === taskId)
        if (isSeededTask) {
          const saved = await workflowService.updateTaskStatus(taskId, to, rejectReason)

          setAllTasks((prev) =>
            prev.map((t) => (t.id === taskId ? saved : t))
          )

          // If this task belongs to current user, keep personal MyTasks in sync
          const currentStoreTasks = useWorkflowStore.getState().kanban.tasks
          if (currentStoreTasks.some((t) => t.id === taskId)) {
            useWorkflowStore.setState((state) => ({
              kanban: {
                ...state.kanban,
                tasks: state.kanban.tasks.map((t) => (t.id === taskId ? saved : t)),
              },
            }))
          }
        }

        const msgFn = SUCCESS_MESSAGES[`${previousStatus}>${to}`]
        if (msgFn) showToast(msgFn(task.code))
      } catch (err) {
        // Rollback on failure
        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        )
        if (phase && phaseTree && phaseTree[taskId]) {
          useWorkflowStore.getState().updateTree(phase.id, (nodes) => {
            if (!nodes[taskId] || nodes[taskId].kind !== 'branch') return nodes
            return {
              ...nodes,
              [taskId]: {
                ...nodes[taskId],
                status: previousStatus,
              },
            }
          })
        }
        showToast(
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái. Vui lòng thử lại.'
        )
      } finally {
        setPendingTaskIds((prev) => prev.filter((id) => id !== taskId))
      }
    },
    [phaseTasks, allTasks, pendingTaskIds, members, actor, phase, phaseTree, showToast]
  )

  // 5. Submit Artifact deliverable
  const submitArtifact = useCallback(
    async (
      taskId: string,
      form: { type: ArtifactType; url: string; note: string }
    ): Promise<boolean> => {
      const task = allTasks.find((t) => t.id === taskId)
      if (!task) return false

      setPendingTaskIds((prev) => [...prev, taskId])
      try {
        const result = await workflowService.submitTaskArtifact({
          taskId,
          ...form,
        })

        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? result.task : t))
        )

        // Sync with store if belonging to current user
        const currentStoreTasks = useWorkflowStore.getState().kanban.tasks
        if (currentStoreTasks.some((t) => t.id === taskId)) {
          useWorkflowStore.setState((state) => ({
            kanban: {
              ...state.kanban,
              tasks: state.kanban.tasks.map((t) =>
                t.id === taskId ? result.task : t
              ),
            },
          }))
        }

        setIsSubmitModalOpen(false)
        setSubmittingTaskId(null)
        showToast(`Đã nộp minh chứng cho ${task.code}: chờ Lead nghiệm thu.`)
        return true
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Không thể gửi minh chứng. Vui lòng thử lại.'
        )
        return false
      } finally {
        setPendingTaskIds((prev) => prev.filter((id) => id !== taskId))
      }
    },
    [allTasks, showToast]
  )

  const submittingTask = useMemo(
    () => (submittingTaskId ? allTasks.find((t) => t.id === submittingTaskId) || null : null),
    [allTasks, submittingTaskId]
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
    allTasks,
    phaseTasks,
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
    refreshTasks: loadProjectTasks,
  }
}
