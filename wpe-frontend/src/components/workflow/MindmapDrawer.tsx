import { Link2, Merge, X } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { GRAPH_READ_ONLY_MESSAGE, selectCanEditGraph, useWorkflowStore } from '../../store/useWorkflowStore'
import { useResizable } from '../../hooks/useResizable'
import { MindmapTree } from '../mindmap/MindmapTree'
import { NodePropertiesModal } from '../mindmap/NodePropertiesModal'
import { AddGhostModal } from '../mindmap/AddGhostModal'
import { AddRootTaskModal } from '../mindmap/AddRootTaskModal'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import { cycleNodesOf, graphErrorMessage, useGraphErrorHandler } from './useGraphErrorHandler'
import { Popover } from '../popovers/Popover'
import { GhostInfo } from '../popovers/GhostInfo'
import { GhostPicker } from '../popovers/GhostPicker'
import type { BranchGraphNode, GhostGraphNode } from '../../types/workflow.types'
import { isAncestor, TASK_H, W } from '../../utils/spanningTreeLayout'
import { PhaseKanbanBoard } from '../kanban/PhaseKanbanBoard'
import { TaskDetailModal } from '../kanban/TaskDetailModal'
import { SubmitArtifactModal } from '../kanban/SubmitArtifactModal'
import { usePhaseKanban } from '../../hooks/usePhaseKanban'
import { useWorkflowService } from '../../services/workflow/WorkflowContext'
import type { KanbanTask } from '../../types/kanban.types'

export function MindmapDrawer() {
  const selectedPhaseId = useWorkflowStore((state) => state.selectedPhaseId)
  const phase = useWorkflowStore((state) =>
    state.macroPhases.find((item) => item.id === selectedPhaseId)
  )
  const selectPhase = useWorkflowStore((state) => state.selectPhase)
  const tree = useWorkflowStore((state) =>
    selectedPhaseId ? state.trees[selectedPhaseId] : undefined
  )
  const trees = useWorkflowStore((state) => state.trees)
  const updateTree = useWorkflowStore((state) => state.updateTree)
  const deleteNode = useWorkflowStore((state) => state.deleteNode)
  const resetPhaseTree = useWorkflowStore((state) => state.resetPhaseTree)
  // B5: quyền sửa và các thao tác ghi đồ thị qua API (chế độ API thật)
  const canEdit = useWorkflowStore(selectCanEditGraph)
  const graphWritesUseApi = useWorkflowStore((state) => state.graphWritesUseApi)
  const addRootTaskViaApi = useWorkflowStore((state) => state.addRootTask)
  const attachGhostViaApi = useWorkflowStore((state) => state.attachGhostNode)
  const connectNodesViaApi = useWorkflowStore((state) => state.connectNodes)
  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const { handleError, cycleNodes, closeCycleModal } = useGraphErrorHandler()
  const [isRootTaskModalOpen, setIsRootTaskModalOpen] = useState(false)

  const { w, dragging, onMouseDown } = useResizable(
    Math.round(window.innerWidth * 0.5)
  )

  // View mode switcher: 'graph' (default) ⇄ 'kanban'
  const workflowService = useWorkflowService()
  const [viewMode, setViewMode] = useState<'graph' | 'kanban'>('graph')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)
  const [mergeSelection, setMergeSelection] = useState(new Set<string>())
  const [isGhostModalOpen, setIsGhostModalOpen] = useState(false)
  const [ghostAnchorTaskId, setGhostAnchorTaskId] = useState<string | undefined>()
  const [popover, setPopover] = useState<{
    type: 'info' | 'picker'
    id?: string
    x: number
    y: number
    anchorId?: string
  } | null>(null)

  // Reset all transient popovers, modals, and selections when switching phases
  useEffect(() => {
    setPopover(null)
    setSelectedNodeId(null)
    setSelectedTask(null)
    setMergeSelection(new Set())
    setIsGhostModalOpen(false)
    setGhostAnchorTaskId(undefined)
    setIsRootTaskModalOpen(false)
  }, [selectedPhaseId])

  // Automatically ensure phase tree data is loaded if missing
  useEffect(() => {
    if (selectedPhaseId && !tree) {
      void resetPhaseTree(selectedPhaseId)
    }
  }, [selectedPhaseId, tree, resetPhaseTree])

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
  } = usePhaseKanban(phase)

  // Active selected task kept up to date with updates
  const activeSelectedTask = useMemo(() => {
    if (!selectedTask) return null
    return phaseTasks.find((t) => t.id === selectedTask.id) || selectedTask
  }, [selectedTask, phaseTasks])

  const toggleMerge = (id: string) =>
    setMergeSelection((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const addGhost = (value: {
    refPhase: string
    refId: string
    dir: 'up' | 'down'
    anchorId?: string
    targetTaskId?: string
  }) => {
    if (!selectedPhaseId || !canEdit) return
    const targetTaskId = value.targetTaskId || value.anchorId
    if (targetTaskId) {
      const payload = { sourcePhaseId: value.refPhase, sourceTaskId: value.refId, targetTaskId }
      if (graphWritesUseApi) void attachGhostViaApi(selectedPhaseId, payload).catch(handleError)
      else void workflowService.attachGhostNode(selectedPhaseId, payload)
    }
    setPopover(null)
  }

  /** Chế độ API: thêm cạnh ghost (nút Attach). Lỗi 422 mở modal chu trình, lỗi khác báo trong modal. */
  const attachGhost = async (payload: { sourcePhaseId: string; sourceTaskId: string; targetTaskId: string }) => {
    if (!selectedPhaseId) return
    if (!graphWritesUseApi) {
      await workflowService.attachGhostNode(selectedPhaseId, payload)
      return
    }
    try {
      await attachGhostViaApi(selectedPhaseId, payload)
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
    if (!selectedPhaseId || !tree) return
    const source = tree[parentId]
    const target = tree[childId]
    if (!source || !target || target.kind !== 'branch') {
      showToast('Chỉ nối được vào một node công việc.', 3000)
      return
    }
    if (source.kind === 'root') {
      showToast('Không nối từ gốc phase. Hãy kéo từ một node công việc.', 3000)
      return
    }
    if (source.kind === 'ghost') {
      void attachGhostViaApi(selectedPhaseId, {
        sourcePhaseId: source.refPhase,
        sourceTaskId: source.refId,
        targetTaskId: childId,
      }).catch(handleError)
      return
    }
    void connectNodesViaApi(selectedPhaseId, parentId, childId).catch(handleError)
  }

  const createMerge = () => {
    if (!selectedPhaseId || mergeSelection.size < 2) return
    const parents = [...mergeSelection]
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
      phaseId: selectedPhaseId,
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
    updateTree(selectedPhaseId, (nodes) => ({ ...nodes, [child.id]: child }))
    setMergeSelection(new Set())
  }

  if (!phase) return null

  return (
    <aside
      style={{ width: Math.max(w, viewMode === 'kanban' ? 540 : 380) }}
      className={`relative flex h-full shrink-0 flex-col border-l border-slate-200 bg-white ${
        dragging ? '' : 'transition-all duration-300'
      }`}
    >
      {/* Col resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 z-10 h-full w-[7px] -translate-x-1/2 cursor-col-resize hover:bg-indigo-300"
        aria-label="Resize panel"
      />

      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400 truncate max-w-[200px] xl:max-w-none" title={`Marketing Q4 › Workflow › ${phase.name}`}>
            Marketing Q4 › Workflow › {phase.name}
          </div>
          <h2 className="mt-1 truncate text-base font-semibold text-slate-800">
            {phase.sub}
          </h2>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <i
              className={`block h-full rounded-full transition-all duration-300 ${phase.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-blue-400'}`}
              style={{ width: `${phase.pct}%` }}
            />
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          <strong className="text-sm text-slate-600 mr-0.5">{phase.pct}%</strong>

          {/* Segmented View Switcher: Graph ⇄ Kanban */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              title="Graph Node Tree View"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'graph'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
              className="rounded-lg p-1.5 text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Link2 size={16} />
            </button>
          )}

          {/* Close drawer */}
          <button
            type="button"
            onClick={() => selectPhase(null)}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── Conditional Body Content ── */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {viewMode === 'graph' ? (
          /* 1. GIỮ NGUYÊN SƠ ĐỒ NODE TASK HIỆN TẠI */
          <div className="w-full h-full overflow-hidden relative">
            {tree ? (
              <MindmapTree
                key={selectedPhaseId}
                nodes={tree}
                selectedId={selectedNodeId}
                onSelect={(id) => setSelectedNodeId(id || null)}
                onDelete={(id) => {
                  if (selectedPhaseId) deleteNode(selectedPhaseId, id)
                  setSelectedNodeId(null)
                }}
                mergeSelection={mergeSelection}
                onToggleMerge={toggleMerge}
                onGhostClick={(id, rect) =>
                  setPopover({
                    type: 'info',
                    id,
                    x: rect.right + 8,
                    y: rect.top,
                  })
                }
                onUpdateNodes={(update) =>
                  selectedPhaseId && updateTree(selectedPhaseId, update)
                }
                onAddGhost={(pos) => {
                  if (!canEdit) return
                  setGhostAnchorTaskId(pos?.anchorId || selectedNodeId || undefined)
                  setIsGhostModalOpen(true)
                }}
                phaseId={selectedPhaseId ?? undefined}
                readOnly={!canEdit}
                // Chế độ API: "+ Add Root Task" mở hộp nhập tên rồi POST /nodes; kéo-nối gọi POST /dependencies.
                // Chế độ mock: giữ cách cũ (thêm và nối cục bộ).
                onAddRootTask={graphWritesUseApi ? () => setIsRootTaskModalOpen(true) : undefined}
                onConnectNodes={graphWritesUseApi ? connectNodes : undefined}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-400">
                Loading phase tree…
              </div>
            )}
          </div>
        ) : (
          /* 2. HIỂN THỊ BẢNG KANBAN CỦA PHASE */
          <div className="w-full h-full p-4 overflow-y-auto">
            {loadingTasks && phaseTasks.length === 0 ? (
              <div className="grid h-full place-items-center text-xs text-slate-400">
                Loading Kanban board for {phase.name}…
              </div>
            ) : (
              <PhaseKanbanBoard
                phaseId={phase.id}
                tasks={phaseTasks}
                members={members}
                actor={actor}
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
            {mergeSelection.size} tasks selected
          </span>
          <button
            type="button"
            onClick={createMerge}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors cursor-pointer"
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
            onClose={() => setSelectedNodeId(null)}
            onSave={(updated) => {
              if (selectedPhaseId && selectedNodeId) {
                updateTree(selectedPhaseId, (nodes) => {
                  const current = nodes[selectedNodeId]
                  if (!current || current.kind !== 'branch') return nodes
                  return {
                    ...nodes,
                    [selectedNodeId]: {
                      ...current,
                      ...updated,
                    },
                  }
                })
              }
              setSelectedNodeId(null)
            }}
            onDelete={() => {
              if (selectedPhaseId) deleteNode(selectedPhaseId, selectedNodeId)
              setSelectedNodeId(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Task Details Modal in Phase Kanban */}
      <AnimatePresence mode="wait">
        {activeSelectedTask && (
          <TaskDetailModal
            key="task-detail"
            task={activeSelectedTask}
            actor={actor}
            members={members}
            pending={pendingTaskIds.includes(activeSelectedTask.id)}
            onClose={() => setSelectedTask(null)}
            onMove={(to, rejectReason) => void moveTask(activeSelectedTask.id, to, rejectReason)}
            onSubmitArtifact={(dto) => submitArtifact(activeSelectedTask.id, dto)}
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

      {/* Popovers for Ghosts in Graph View */}
      <AnimatePresence mode="wait">
        {popover?.type === 'info' && popover.id && (() => {
          const ghostId = popover.id
          const ghostNode = ghostId && tree?.[ghostId]?.kind === 'ghost' ? (tree[ghostId] as GhostGraphNode) : null
          return (
            <Popover
              key={`ghost-info-${selectedPhaseId}-${ghostId}`}
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
                        selectPhase(ghostNode.refPhase)
                        setPopover(null)
                      }
                    : undefined
                }
              />
            </Popover>
          )
        })()}

        {popover?.type === 'picker' && (
          <Popover
            key={`ghost-picker-${selectedPhaseId}`}
            x={popover.x}
            y={popover.y}
            w={310}
            onClose={() => setPopover(null)}
          >
            <GhostPicker
              trees={trees}
              currentPhase={selectedPhaseId ?? ''}
              anchorId={popover.anchorId}
              onConfirm={addGhost}
              onClose={() => setPopover(null)}
            />
          </Popover>
        )}
      </AnimatePresence>

      {/* Redesigned 3-Step Add Ghost Node Modal */}
      <AddGhostModal
        isOpen={isGhostModalOpen && canEdit}
        onClose={() => {
          setIsGhostModalOpen(false)
          setGhostAnchorTaskId(undefined)
        }}
        currentPhaseId={selectedPhaseId ?? ''}
        anchorTaskId={ghostAnchorTaskId}
        onAttach={async (payload) => {
          if (!selectedPhaseId) return
          await attachGhost(payload)
          setIsGhostModalOpen(false)
          setGhostAnchorTaskId(undefined)
        }}
      />

      {/* B5 chế độ API: thêm node vào phase (POST /projects/{id}/nodes) */}
      <AddRootTaskModal
        isOpen={isRootTaskModalOpen && canEdit && graphWritesUseApi}
        onClose={() => setIsRootTaskModalOpen(false)}
        phaseId={selectedPhaseId ?? ''}
        onCreated={async (title) => {
          if (!selectedPhaseId) return
          try {
            await addRootTaskViaApi(selectedPhaseId, title)
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
    </aside>
  )
}
