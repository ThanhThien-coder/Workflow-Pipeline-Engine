import { ArrowLeft, Link2, Merge } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GRAPH_READ_ONLY_MESSAGE, selectCanEditGraph, useWorkflowStore } from '../../store/useWorkflowStore'
import { MindmapTree } from '../mindmap/MindmapTree'
import { NodePropertiesModal } from '../mindmap/NodePropertiesModal'
import { AddGhostModal } from '../mindmap/AddGhostModal'
import { AddRootTaskModal } from '../mindmap/AddRootTaskModal'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import { cycleNodesOf, graphErrorMessage, useGraphErrorHandler } from './useGraphErrorHandler'
import { Popover } from '../popovers/Popover'
import { GhostInfo } from '../popovers/GhostInfo'
import type { BranchGraphNode, GhostGraphNode } from '../../types/workflow.types'
import { TASK_H, W } from '../../utils/spanningTreeLayout'
import { toTaskNodePatch } from '../../mappers/graphMapper'
import { prerequisitesOf } from '../../utils/taskPrerequisites'
import { PhaseKanbanBoard } from '../kanban/PhaseKanbanBoard'
import { TaskDetailModal } from '../kanban/TaskDetailModal'
import { SubmitArtifactModal } from '../kanban/SubmitArtifactModal'
import { usePhaseKanban } from '../../hooks/usePhaseKanban'
import { useWorkflowService } from '../../services/workflow/WorkflowContext'
import { useRouter } from '../../router/useRouter'
import type { KanbanTask } from '../../types/kanban.types'
import { pluralize } from '../../utils/pluralize'
import { phaseDisplayName } from '../../utils/phaseName'
import { selectProjectStatus } from '../../store/projectInfo'
import { isProjectStarted } from '../../domain/projectWork'

/** Đường dẫn màn chi tiết phase. */
export function phaseDetailPath(projectId: string, phaseId: string): string {
  return `/project/${projectId}/workflow/phase/${encodeURIComponent(phaseId)}`
}

/**
 * Màn chi tiết phase TOÀN MÀN HÌNH (thay cho panel kéo giãn bên phải cũ).
 * Phase lấy theo `phaseId` của ĐƯỜNG DẪN, không dựa vào `selectedPhaseId`: store có thể xóa selectedPhaseId
 * (loadPhases khi đổi dự án) mà màn này vẫn đúng phase.
 */
export function PhaseDetailView({ projectId, phaseId }: { projectId: string; phaseId: string }) {
  const { navigate } = useRouter()
  const currentProjectId = useWorkflowStore((state) => state.currentProjectId)
  const graphStatus = useWorkflowStore((state) => state.graphStatus)
  const graphError = useWorkflowStore((state) => state.graphError)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  // Dữ liệu chỉ tin được khi đồ thị trong store là của đúng dự án này
  const dataIsForProject = currentProjectId !== null && String(currentProjectId) === String(projectId)
  const phase = useWorkflowStore((state) =>
    dataIsForProject ? state.macroPhases.find((item) => item.id === phaseId) : undefined
  )
  const tree = useWorkflowStore((state) => (dataIsForProject ? state.trees[phaseId] : undefined))
  const updateTree = useWorkflowStore((state) => state.updateTree)
  const deleteNode = useWorkflowStore((state) => state.deleteNode)
  const resetPhaseTree = useWorkflowStore((state) => state.resetPhaseTree)
  // Tên dự án thật (tải lúc vào dự án), chưa có thì bỏ khỏi breadcrumb
  const projectName = useWorkflowStore((state) =>
    state.project.projectId === state.currentProjectId ? state.project.info?.name : undefined
  )
  // B5: quyền sửa và các thao tác ghi đồ thị qua API (chế độ API thật)
  const canEdit = useWorkflowStore(selectCanEditGraph)
  const graphWritesUseApi = useWorkflowStore((state) => state.graphWritesUseApi)
  const addRootTaskViaApi = useWorkflowStore((state) => state.addRootTask)
  const attachGhostViaApi = useWorkflowStore((state) => state.attachGhostNode)
  const connectNodesViaApi = useWorkflowStore((state) => state.connectNodes)
  const addChildTaskViaApi = useWorkflowStore((state) => state.addChildTask)
  const updateNodeInfoViaApi = useWorkflowStore((state) => state.updateNodeInfo)
  const removeNodeViaApi = useWorkflowStore((state) => state.removeNode)
  const removeDependencyViaApi = useWorkflowStore((state) => state.removeDependency)
  const forceUnlockViaApi = useWorkflowStore((state) => state.forceUnlockNode)
  // G33: chưa Start thì mọi task đều khóa, không cho mở khóa sớm
  const projectStarted = useWorkflowStore((state) => isProjectStarted(selectProjectStatus(state)))
  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const { handleError, cycleNodes, closeCycleModal } = useGraphErrorHandler()
  // Chế độ API: hộp nhập tên trước khi tạo task, subtask (1 cha) hoặc task hội tụ (nhiều cha)
  const [taskModal, setTaskModal] = useState<{ kind: 'root' } | { kind: 'child'; parentIds: string[] } | null>(null)

  // View mode switcher: 'graph' (default) ⇄ 'kanban'
  const workflowService = useWorkflowService()
  const [viewMode, setViewMode] = useState<'graph' | 'kanban'>('graph')
  // S09: chọn một task từ ô tìm kiếm khi đang xem Kanban của chính phase này -> chuyển sang Graph để task được làm nổi
  const highlightNodeId = useWorkflowStore((state) => state.ui.highlightNodeId)
  useEffect(() => {
    if (highlightNodeId && tree?.[highlightNodeId] && viewMode === 'kanban') setViewMode('graph')
  }, [highlightNodeId, tree, viewMode])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)
  const [mergeSelection, setMergeSelection] = useState(new Set<string>())
  const [isGhostModalOpen, setIsGhostModalOpen] = useState(false)
  const [ghostAnchorTaskId, setGhostAnchorTaskId] = useState<string | undefined>()
  const [popover, setPopover] = useState<{ id: string; x: number; y: number } | null>(null)

  // Mở thẳng đường dẫn (F5) hoặc đổi dự án: đồ thị chưa tải cho dự án này thì tải
  useEffect(() => {
    if (!dataIsForProject || graphStatus === 'idle') void loadPhases(projectId)
    // chỉ chạy lại khi đổi dự án; trạng thái 'loading'/'ready' không kích hoạt tải thêm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dataIsForProject])

  // Reset all transient popovers, modals, and selections when switching phases
  useEffect(() => {
    setPopover(null)
    setSelectedNodeId(null)
    setSelectedTask(null)
    setMergeSelection(new Set())
    setIsGhostModalOpen(false)
    setGhostAnchorTaskId(undefined)
    setTaskModal(null)
  }, [phaseId])

  // Automatically ensure phase tree data is loaded if missing
  useEffect(() => {
    if (phase && !tree) {
      void resetPhaseTree(phaseId)
    }
  }, [phase, phaseId, tree, resetPhaseTree])

  // Hook managing phase-wide Kanban tasks, members, and status transitions
  const {
    phaseTasks,
    members,
    actor,
    loading: loadingTasks,
    pendingTaskIds,
    submittingTask,
    isSubmitModalOpen,
    toastMessage,
    moveTask,
    submitArtifact,
    closeSubmitModal,
    updateAssignment,
    reopenTask,
    getReopenImpact,
  } = usePhaseKanban(phase, currentProjectId)

  // Active selected task kept up to date with updates
  const activeSelectedTask = useMemo(() => {
    if (!selectedTask) return null
    return phaseTasks.find((t) => t.id === selectedTask.id) || selectedTask
  }, [selectedTask, phaseTasks])

  const backToWorkflow = () => navigate(`/project/${projectId}/workflow`)

  const toggleMerge = (id: string) =>
    setMergeSelection((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /** Chế độ API: thêm cạnh ghost (nút Attach). Lỗi 422 mở modal chu trình, lỗi khác báo trong modal. */
  const attachGhost = async (payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }) => {
    if (!dataIsForProject) return
    if (!graphWritesUseApi) {
      await workflowService.attachGhostNode(phaseId, payload)
      return
    }
    try {
      await attachGhostViaApi(phaseId, payload)
    } catch (error) {
      if (cycleNodesOf(error)) {
        handleError(error) // mở KahnCycleModal, đóng hộp Attach
        return
      }
      throw new Error(graphErrorMessage(error)) // hiện ngay trong hộp Attach
    }
  }

  /**
   * Chế độ API: kéo-nối 2 node trên cây. Nguồn là ghost thì cha thật là node ở phase khác (refId).
   * Nguồn là gốc phase thì không có cạnh tương ứng ở backend.
   */
  const connectNodes = (parentId: string, childId: string) => {
    if (!tree) return
    const source = tree[parentId]
    const target = tree[childId]
    if (!source || !target || target.kind !== 'branch') {
      showToast('You can only connect to a task node.', 3000)
      return
    }
    if (source.kind === 'root') {
      showToast('Cannot connect from the phase root. Drag from a task node instead.', 3000)
      return
    }
    if (source.kind === 'ghost') {
      void attachGhostViaApi(phaseId, {
        sourcePhaseId: source.refPhase,
        sourceTaskId: source.refId,
        targetTaskId: childId,
      }).catch(handleError)
      return
    }
    void connectNodesViaApi(phaseId, parentId, childId).catch(handleError)
  }

  /** Gỡ một phụ thuộc: ghost thì cha thật là task nguồn ở phase khác (refId), còn lại là chính node nguồn. */
  const removeLink = (sourceId: string, targetId: string) => {
    const source = tree?.[sourceId]
    const parentTaskId = source?.kind === 'ghost' ? source.refId : sourceId
    void removeDependencyViaApi(phaseId, parentTaskId, targetId).catch(handleError)
  }

  const taskTitle = (id: string) => {
    const node = tree?.[id]
    return node && node.kind !== 'ghost' ? `"${node.title}"` : 'the selected task'
  }

  /** Chế độ API: đổi tên trên thẻ = sửa task (PUT /nodes/{id}) với các trường còn lại giữ nguyên. */
  const renameTask = (id: string, title: string) => {
    const node = tree?.[id]
    if (node?.kind !== 'branch') return
    void updateNodeInfoViaApi(phaseId, id, { ...toTaskNodePatch(node), title }).catch(handleError)
  }

  /** Xóa ghost = gỡ cạnh phụ thuộc (refId → task đích). Ghost không phải là một task nên không có node để xóa. */
  const removeGhost = (ghost: GhostGraphNode) => {
    if (graphWritesUseApi) {
      const targetTaskId =
        ghost.targetTaskId ??
        Object.values(tree ?? {}).find((node) => node.kind === 'branch' && node.parentIds.includes(ghost.id))?.id
      if (!targetTaskId) {
        showToast('Could not find the task this ghost points to.', 3000)
        return
      }
      void removeDependencyViaApi(phaseId, ghost.refId, targetTaskId).catch(handleError)
    } else {
      deleteNode(phaseId, ghost.id)
    }
  }

  const removeTask = (id: string) => {
    const node = tree?.[id]
    if (node?.kind === 'ghost') {
      removeGhost(node)
      return
    }
    if (graphWritesUseApi) void removeNodeViaApi(phaseId, id).catch(handleError)
    else deleteNode(phaseId, id)
  }

  const createMerge = () => {
    if (mergeSelection.size < 2) return
    const parents = [...mergeSelection]
    if (graphWritesUseApi) {
      setTaskModal({ kind: 'child', parentIds: parents })
      return
    }
    const childId = `task-${Date.now()}`
    const code = `WPE-${Math.floor(100 + Math.random() * 900)}`
    const firstParent = tree?.[parents[0]]
    const trackId =
      firstParent?.kind === 'branch'
        ? (firstParent as BranchGraphNode).trackId || parents[0]
        : parents[0]

    const child: BranchGraphNode = {
      kind: 'branch',
      id: childId,
      code,
      title: 'Converged task',
      phaseId,
      trackId,
      parentId: parents[0],
      parentIds: parents,
      description: 'Converged from prerequisite tasks',
      isTrack: false,
      status: parents.every(
        (id) => tree?.[id]?.kind === 'branch' && tree[id].status === 'DONE'
      )
        ? 'TODO'
        : 'LOCKED',
      progress: 0,
      assignee: null,
      due: null,
      blocker: 'Waiting for all source tasks',
      joinPolicy: 'ALL_COMPLETED',
      level: 3,
      order: 0,
      column: 3,
      row: 0,
      width: W.task,
      height: TASK_H,
    }
    updateTree(phaseId, (nodes) => ({ ...nodes, [child.id]: child }))
    setMergeSelection(new Set())
  }

  // Chưa có phase để vẽ: đang tải, lỗi hoặc không tìm thấy
  if (!phase) {
    const loading = !dataIsForProject || graphStatus === 'idle' || graphStatus === 'loading'
    return (
      <div className="flex h-full w-full flex-col bg-white">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={backToWorkflow}
            aria-label="Back to workflow"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        </header>
        <div className="grid flex-1 place-items-center px-6 text-center text-sm text-slate-500">
          {loading ? (
            <span>Loading phase…</span>
          ) : graphStatus === 'error' ? (
            <div className="flex flex-col items-center gap-3">
              <span>{graphError || 'Failed to load the graph'}</span>
              <button
                type="button"
                onClick={() => void loadPhases(projectId)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <span className="font-medium text-slate-600">Phase not found</span>
          )}
        </div>
      </div>
    )
  }

  const phaseName = phaseDisplayName(phase)
  const breadcrumb = [projectName, 'Workflow', phaseName].filter(Boolean).join(' › ')

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={backToWorkflow}
            aria-label="Back to workflow"
            title="Back to workflow"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <div className="min-w-0">
            <div className="truncate text-[11px] text-slate-400" title={breadcrumb}>
              {breadcrumb}
            </div>
            <h2 className="mt-0.5 truncate text-base font-semibold text-slate-800">{phaseName}</h2>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex" title={`${phase.pct}% complete`}>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
              <i
                className={`block h-full rounded-full transition-all duration-300 ${phase.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-blue-400'}`}
                style={{ width: `${phase.pct}%` }}
              />
            </div>
            <strong className="text-sm text-slate-600">{phase.pct}%</strong>
          </div>

          {/* Segmented View Switcher: Graph ⇄ Kanban */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              title="Graph Node Tree View"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                viewMode === 'graph'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Graph</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Phase Kanban Board View"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="11" y="3" width="5" height="12" rx="1" />
                <rect x="19" y="3" width="5" height="15" rx="1" />
              </svg>
              <span>Kanban</span>
            </button>
          </div>

          {/* Add ghost node (only in graph mode) */}
          {viewMode === 'graph' && (
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => {
                setGhostAnchorTaskId(selectedNodeId ?? undefined)
                setIsGhostModalOpen(true)
              }}
              title={canEdit ? 'Attach Ghost Prerequisite' : GRAPH_READ_ONLY_MESSAGE}
              aria-label="Add ghost node"
              className="rounded-lg p-1.5 text-indigo-500 transition-colors hover:bg-indigo-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Link2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* ── Conditional Body Content ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {viewMode === 'graph' ? (
          <div className="relative h-full w-full overflow-hidden bg-slate-50/50">
            {tree ? (
              <MindmapTree
                key={phaseId}
                nodes={tree}
                selectedId={selectedNodeId}
                onSelect={(id) => setSelectedNodeId(id || null)}
                onDelete={(id) => {
                  removeTask(id)
                  setSelectedNodeId(null)
                }}
                mergeSelection={mergeSelection}
                onToggleMerge={toggleMerge}
                onGhostClick={(id, rect) =>
                  setPopover({
                    id,
                    x: rect.right + 8,
                    y: rect.top,
                  })
                }
                onUpdateNodes={(update) => updateTree(phaseId, update)}
                onAddGhost={(pos) => {
                  if (!canEdit) return
                  setGhostAnchorTaskId(pos?.anchorId || selectedNodeId || undefined)
                  setIsGhostModalOpen(true)
                }}
                phaseId={phaseId}
                readOnly={!canEdit}
                // Chế độ API: "+ Add task" mở hộp nhập tên rồi POST /nodes; kéo-nối gọi POST /dependencies.
                // Chế độ mock: giữ cách cũ (thêm và nối cục bộ).
                onAddRootTask={graphWritesUseApi ? () => setTaskModal({ kind: 'root' }) : undefined}
                onAddChildTask={graphWritesUseApi ? (parentId) => setTaskModal({ kind: 'child', parentIds: [parentId] }) : undefined}
                onRenameNode={graphWritesUseApi ? renameTask : undefined}
                onConnectNodes={graphWritesUseApi ? connectNodes : undefined}
                onRemoveDependency={graphWritesUseApi ? removeLink : undefined}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-400">
                Loading phase tree…
              </div>
            )}
          </div>
        ) : (
          /* HIỂN THỊ BẢNG KANBAN CỦA PHASE */
          <div className="h-full w-full overflow-y-auto p-4">
            {loadingTasks && phaseTasks.length === 0 ? (
              <div className="grid h-full place-items-center text-xs text-slate-400">
                Loading Kanban board for {phaseName}…
              </div>
            ) : (
              <PhaseKanbanBoard
                phaseId={phase.id}
                tasks={phaseTasks}
                members={members}
                actor={actor ?? undefined}
                pendingIds={pendingTaskIds}
                onMoveTask={moveTask}
                onOpenTaskDetails={(task) => setSelectedTask(task)}
              />
            )}
          </div>
        )}
      </div>

      {/* Merge Selection Bar in Graph View */}
      {viewMode === 'graph' && canEdit && mergeSelection.size >= 2 && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-xs font-medium text-amber-700">
            {pluralize(mergeSelection.size, 'task')} selected
          </span>
          <button
            type="button"
            onClick={createMerge}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 cursor-pointer"
          >
            <Merge size={13} />
            Create converged task from {mergeSelection.size} selected tasks
          </button>
        </div>
      )}

      {/* ── Modals & Popovers ── */}
      <AnimatePresence mode="wait">
        {selectedNodeId && tree?.[selectedNodeId]?.kind === 'branch' && (
          <NodePropertiesModal
            key="node-properties"
            node={tree[selectedNodeId] as BranchGraphNode}
            members={members}
            readOnly={!canEdit}
            prerequisites={prerequisitesOf(tree, selectedNodeId)}
            viewerId={actor?.id ?? null}
            isOwner={canEdit}
            canReview={actor?.projectRole === 'OWNER' || actor?.projectRole === 'MANAGER'}
            onForceUnlock={
              graphWritesUseApi && projectStarted
                ? () => void forceUnlockViaApi(phaseId, selectedNodeId).catch(handleError)
                : undefined
            }
            // Đổi trạng thái đi qua Kanban của phase: cùng luật chuyển, cùng hộp nộp minh chứng khi sang Chờ duyệt
            onMoveStatus={(to, reason) => void moveTask(selectedNodeId, to, reason)}
            onClose={() => setSelectedNodeId(null)}
            onSave={(updated) => {
              const current = tree[selectedNodeId]
              if (graphWritesUseApi && current?.kind === 'branch') {
                const patch = toTaskNodePatch({ ...current, ...updated })
                void updateNodeInfoViaApi(phaseId, selectedNodeId, patch).catch(handleError)
              } else if (selectedNodeId) {
                updateTree(phaseId, (nodes) => {
                  const node = nodes[selectedNodeId]
                  if (!node || node.kind !== 'branch') return nodes
                  return {
                    ...nodes,
                    [selectedNodeId]: {
                      ...node,
                      ...updated,
                    },
                  }
                })
              }
              setSelectedNodeId(null)
            }}
            onDelete={() => {
              removeTask(selectedNodeId)
              setSelectedNodeId(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Task Details Modal in Phase Kanban */}
      <AnimatePresence mode="wait">
        {activeSelectedTask && actor && (
          <TaskDetailModal
            key="task-detail"
            task={activeSelectedTask}
            actor={actor}
            members={members}
            pending={pendingTaskIds.includes(activeSelectedTask.id)}
            onClose={() => setSelectedTask(null)}
            onMove={(to, rejectReason) => void moveTask(activeSelectedTask.id, to, rejectReason)}
            onSubmitArtifact={(dto) => submitArtifact(activeSelectedTask.id, dto)}
            onUpdateAssignment={(cmd) => updateAssignment(activeSelectedTask.id, cmd)}
            onReopen={(reason) => reopenTask(activeSelectedTask.id, reason)}
            getReopenImpact={() => getReopenImpact(activeSelectedTask.id)}
          />
        )}
      </AnimatePresence>

      {/* Submit Artifact Modal for Transition Review Requirement */}
      <AnimatePresence mode="wait">
        {isSubmitModalOpen && submittingTask && (
          <SubmitArtifactModal
            key="submit-artifact"
            task={submittingTask}
            submitting={pendingTaskIds.includes(submittingTask.id)}
            onClose={closeSubmitModal}
            onSubmit={(dto) => submitArtifact(submittingTask.id, dto)}
          />
        )}
      </AnimatePresence>

      {/* Popover thông tin ghost trong Graph View */}
      <AnimatePresence mode="wait">
        {popover && (() => {
          const ghostNode = tree?.[popover.id]?.kind === 'ghost' ? (tree[popover.id] as GhostGraphNode) : null
          return (
            <Popover
              key={`ghost-info-${phaseId}-${popover.id}`}
              x={popover.x}
              y={popover.y}
              w={290}
              onClose={() => setPopover(null)}
            >
              <GhostInfo
                node={ghostNode}
                onOpen={
                  ghostNode?.refPhase
                    ? () => {
                        navigate(phaseDetailPath(projectId, ghostNode.refPhase))
                        setPopover(null)
                      }
                    : undefined
                }
              />
            </Popover>
          )
        })()}
      </AnimatePresence>

      {/* Redesigned 3-Step Add Ghost Node Modal */}
      <AddGhostModal
        isOpen={isGhostModalOpen && canEdit}
        onClose={() => {
          setIsGhostModalOpen(false)
          setGhostAnchorTaskId(undefined)
        }}
        currentPhaseId={phaseId}
        anchorTaskId={ghostAnchorTaskId}
        onAttach={async (payload) => {
          await attachGhost(payload)
          setIsGhostModalOpen(false)
          setGhostAnchorTaskId(undefined)
        }}
      />

      {/* Chế độ API: hỏi tên rồi tạo task (POST /nodes) hoặc task con / hội tụ (POST /nodes + /dependencies) */}
      <AddRootTaskModal
        isOpen={taskModal !== null && canEdit && graphWritesUseApi}
        onClose={() => setTaskModal(null)}
        phaseId={phaseId}
        {...(taskModal?.kind === 'child'
          ? taskModal.parentIds.length > 1
            ? {
                heading: 'Create merge task',
                description: `The new task waits for the ${taskModal.parentIds.length} selected tasks.`,
                placeholder: 'e.g. Integrate and test',
              }
            : {
                heading: 'Add subtask',
                description: `Subtask of ${taskTitle(taskModal.parentIds[0])}.`,
                placeholder: 'e.g. Build the login API',
              }
          : {
              heading: 'Add task',
              description: 'Create a new task in this phase.',
              placeholder: 'e.g. Build the login API',
            })}
        onCreated={async (title) => {
          if (!taskModal) return
          try {
            if (taskModal.kind === 'root') {
              await addRootTaskViaApi(phaseId, title)
            } else {
              await addChildTaskViaApi(phaseId, taskModal.parentIds, title)
              if (taskModal.parentIds.length > 1) setMergeSelection(new Set())
            }
          } catch (error) {
            // Hiện lỗi ngay trong hộp nhập (giữ tên đã gõ), câu báo theo ApiError.code
            throw new Error(graphErrorMessage(error))
          }
        }}
      />

      {/* B5: nối node tạo vòng (backend trả 422) */}
      <KahnCycleModal violatingNodeIds={cycleNodes} onClose={closeCycleModal} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
