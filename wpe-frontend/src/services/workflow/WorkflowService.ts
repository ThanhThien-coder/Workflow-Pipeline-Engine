import type { GhostDependency, PhaseNode, TaskStatus, BranchGraphNode, GhostGraphNode } from '../../types/workflow.types'
import type { IWorkflowService } from './IWorkflowGraphService'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { W, TASK_H, GHOST_H } from '../../utils/spanningTreeLayout'

export class WorkflowService implements IWorkflowService {
  async getPhaseGraph(phaseId: string): Promise<{
    root: PhaseNode
    nodes: PhaseNode[]
    ghostDependencies: GhostDependency[]
  }> {
    const store = useWorkflowStore.getState()
    let tree = store.trees[phaseId]

    if (!tree) {
      await store.resetPhaseTree(phaseId)
      tree = useWorkflowStore.getState().trees[phaseId] || {}
    }

    const rawRoot = Object.values(tree).find((n) => n.kind === 'root')
    const root: PhaseNode = {
      id: rawRoot?.id || 'root',
      title: rawRoot?.title || 'Phase Root',
      status: 'IN_PROGRESS',
    }

    const ghostDependencies: GhostDependency[] = []
    const ghostNodes = Object.values(tree).filter(
      (n): n is GhostGraphNode => n.kind === 'ghost'
    )

    ghostNodes.forEach((ghost) => {
      const sourcePhaseTree = store.trees[ghost.refPhase] || {}
      const sourceTask = sourcePhaseTree[ghost.refId]
      const sourcePhase = store.macroPhases.find((p) => p.id === ghost.refPhase)

      const isDone =
        ghost.status === 'DONE' ||
        (sourceTask && 'status' in sourceTask && sourceTask.status === 'DONE')

      const status: TaskStatus = isDone ? 'DONE' : 'LOCKED'

      let targetTaskId = ghost.targetTaskId
      if (!targetTaskId) {
        targetTaskId = ghost.parentIds.find(
          (p) => p !== 'root' && tree[p]?.kind === 'branch'
        )
      }
      if (!targetTaskId) {
        targetTaskId = Object.values(tree).find(
          (n) => n.kind === 'branch' && n.parentIds.includes(ghost.id)
        )?.id
      }

      ghostDependencies.push({
        id: ghost.id,
        sourcePhaseId: ghost.refPhase,
        sourcePhaseTitle: ghost.sourcePhaseTitle || sourcePhase?.name || ghost.refPhase,
        sourceTaskId: ghost.refId,
        sourceTaskTitle: ghost.sourceTaskTitle || sourceTask?.title || ghost.title || ghost.refId,
        targetTaskId: targetTaskId || '',
        status,
      })
    })

    const branchNodes = Object.values(tree).filter(
      (n): n is BranchGraphNode => n.kind === 'branch'
    )

    const nodes: PhaseNode[] = branchNodes.map((b) => {
      const ghostsForTask = ghostDependencies.filter((g) => g.targetTaskId === b.id)
      const hasUnfinishedGhost = ghostsForTask.some((g) => g.status !== 'DONE')

      const effectiveStatus: TaskStatus = hasUnfinishedGhost
        ? 'LOCKED'
        : (b.status as TaskStatus)

      return {
        id: b.id,
        title: b.title,
        status: effectiveStatus,
        progress: b.progress,
        assignee: b.assignee
          ? { name: b.assignee, avatarUrl: '', initials: b.assignee.substring(0, 2).toUpperCase() }
          : undefined,
        parentId: b.parentId || b.parentIds[0] || null,
        dependencies: b.parentIds.filter((p) => p !== 'root'),
        ghostPrerequisites: ghostsForTask,
      }
    })

    return { root, nodes, ghostDependencies }
  }

  async addRootTask(phaseId: string, payload: { title: string }): Promise<PhaseNode> {
    const store = useWorkflowStore.getState()
    const tree = store.trees[phaseId] || {}
    const existingTracks = Object.values(tree).filter(
      (n) => n.kind === 'branch' && (n as BranchGraphNode).isTrack
    )

    const trackId = `trk-${Date.now()}`
    const code = `TRK-${String(existingTracks.length + 1).padStart(2, '0')}`

    const newTrack: BranchGraphNode = {
      id: trackId,
      kind: 'branch',
      code,
      title: payload.title.trim() || 'New Track Milestone',
      description: '',
      isTrack: true,
      status: 'TODO',
      parentIds: ['root'],
      parentId: 'root',
      trackId,
      level: 1,
      order: existingTracks.length,
      assignee: null,
      due: null,
      blocker: null,
      joinPolicy: null,
      width: W.track,
      height: 58,
    }

    store.updateTree(phaseId, (nodes) => ({
      ...nodes,
      [trackId]: newTrack,
    }))

    return {
      id: trackId,
      title: newTrack.title,
      status: 'TODO',
      parentId: 'root',
    }
  }

  async attachGhostNode(
    phaseId: string,
    payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }
  ): Promise<GhostDependency> {
    const store = useWorkflowStore.getState()
    const sourceTree = store.trees[payload.sourcePhaseId] || {}
    const sourceTask = sourceTree[payload.sourceTaskId]
    const sourcePhase = store.macroPhases.find((p) => p.id === payload.sourcePhaseId)

    const isSourceDone =
      sourceTask && 'status' in sourceTask && sourceTask.status === 'DONE'

    const ghostId = `ghost-${Date.now()}`
    const sourceTaskTitle = sourceTask?.title || payload.sourceTaskId
    const sourcePhaseTitle = sourcePhase?.name || payload.sourcePhaseId

    const ghostNode: GhostGraphNode = {
      id: ghostId,
      kind: 'ghost',
      title: sourceTaskTitle,
      parentIds: [payload.targetTaskId],
      refPhase: payload.sourcePhaseId,
      refId: payload.sourceTaskId,
      dir: 'up',
      targetTaskId: payload.targetTaskId,
      sourcePhaseTitle,
      sourceTaskTitle,
      status: isSourceDone ? 'DONE' : 'LOCKED',
      width: W.ghost,
      height: GHOST_H,
    }

    store.updateTree(phaseId, (nodes) => {
      const next = { ...nodes, [ghostId]: ghostNode }
      const target = next[payload.targetTaskId]
      if (target && target.kind === 'branch') {
        const parents = target.parentIds || []
        const updatedParents = parents.includes(ghostId) ? parents : [...parents, ghostId]
        next[payload.targetTaskId] = {
          ...target,
          parentIds: updatedParents,
          ...(isSourceDone
            ? {}
            : {
                status: 'LOCKED',
                blocker: `Waiting for external prerequisite: ${sourceTaskTitle} (${sourcePhaseTitle})`,
              }),
        }
      }
      return next
    })

    return {
      id: ghostId,
      sourcePhaseId: payload.sourcePhaseId,
      sourcePhaseTitle,
      sourceTaskId: payload.sourceTaskId,
      sourceTaskTitle,
      targetTaskId: payload.targetTaskId,
      status: isSourceDone ? 'DONE' : 'LOCKED',
    }
  }

  async resetPhaseTree(phaseId: string): Promise<void> {
    await useWorkflowStore.getState().resetPhaseTree(phaseId)
  }
}
