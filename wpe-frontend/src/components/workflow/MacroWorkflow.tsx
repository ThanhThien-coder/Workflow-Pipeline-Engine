import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, LayoutGrid } from 'lucide-react'
import { GRAPH_READ_ONLY_MESSAGE, selectCanEditGraph, useWorkflowStore } from '../../store/useWorkflowStore'
import type { MacroPhase } from '../../types/workflow.types'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import { useGraphErrorHandler } from './useGraphErrorHandler'
import { isApiError } from '../../services/http/ApiError'
import { usePanZoom } from '../../hooks/usePanZoom'
import { WorkflowEdge } from './WorkflowEdge'
import { PhaseCard } from './PhaseCard'
import { CreatePhaseModal } from './CreatePhaseModal'
import { ConfirmDialog } from '../../features/admin/templates/components/ConfirmDialog'
import { ZoomControls } from '../mindmap/ZoomControls'
import { usePhaseConnectDrag } from '../../hooks/usePhaseConnectDrag'
import { computeMacroGraphLayout, MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'
import { WorkflowArtifactsIsland } from '../workspace/WorkflowArtifactsIsland'
import { WorkflowArtifactsDrawer } from '../workspace/WorkflowArtifactsDrawer'

export function MacroWorkflow({ projectId = '1', className = '' }: { projectId?: string; className?: string }) {
  const phases = useWorkflowStore((state) => state.macroPhases)
  const workflowEdges = useWorkflowStore((state) => state.workflowEdges)
  const selectedPhaseId = useWorkflowStore((state) => state.selectedPhaseId)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  const createPhase = useWorkflowStore((state) => state.createPhase)
  const spawnChildPhase = useWorkflowStore((state) => state.spawnChildPhase)
  const connectPhases = useWorkflowStore((state) => state.connectPhases)
  const disconnectPhases = useWorkflowStore((state) => state.disconnectPhases)
  const deletePhase = useWorkflowStore((state) => state.deletePhase)
  const updatePhasePosition = useWorkflowStore((state) => state.updatePhasePosition)
  const selectPhase = useWorkflowStore((state) => state.selectPhase)
  // B5: không phải owner (hoặc dự án ARCHIVED) thì canvas chỉ xem
  const canEdit = useWorkflowStore(selectCanEditGraph)
  const { handleError, cycleNodes, closeCycleModal } = useGraphErrorHandler()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [phaseToDelete, setPhaseToDelete] = useState<MacroPhase | null>(null)
  const [dragPhase, setDragPhase] = useState<{ id: string; x: number; y: number } | null>(null)

  const panZoom = usePanZoom()

  // Lỗi API (403/409/422...) hiện toast hoặc modal chu trình; lỗi khác để hook hiện tooltip như cũ
  const connectPhasesSafe = useCallback(
    async (sourceId: string, targetId: string) => {
      try {
        await connectPhases(sourceId, targetId)
      } catch (error) {
        if (isApiError(error)) handleError(error)
        else throw error
      }
    },
    [connectPhases, handleError]
  )
  const spawnChildPhaseSafe = useCallback(
    (parentPhaseId: string) => spawnChildPhase(parentPhaseId).catch(handleError),
    [spawnChildPhase, handleError]
  )
  const savePhasePosition = useCallback(
    (phaseId: string, pos: { x: number; y: number }) => {
      void updatePhasePosition(phaseId, pos).catch(handleError)
    },
    [updatePhasePosition, handleError]
  )
  const phaseConnect = usePhaseConnectDrag(phases, connectPhasesSafe, spawnChildPhaseSafe, canEdit)

  const phaseRecord = useMemo(
    () => phases.reduce<Record<string, (typeof phases)[number]>>((record, phase) => ({ ...record, [phase.id]: phase }), {}),
    [phases]
  )
  const layoutPositions = useMemo(() => computeMacroGraphLayout(phaseRecord), [phaseRecord])

  // Current real-time positions of each phase (prioritizing drag position, then persisted x/y, then auto layout)
  const currentPositions = useMemo(() => {
    const result: Record<string, { x: number; y: number }> = {}
    phases.forEach((p) => {
      if (dragPhase && dragPhase.id === p.id) {
        result[p.id] = { x: dragPhase.x, y: dragPhase.y }
      } else if (p.x != null && p.y != null) {
        result[p.id] = { x: p.x, y: p.y }
      } else {
        result[p.id] = layoutPositions[p.id] || { x: 40, y: 140 }
      }
    })
    return result
  }, [phases, dragPhase, layoutPositions])

  const workflowSize = useMemo(() => {
    const positions = Object.values(currentPositions)
    return {
      width: Math.max(1800, ...positions.map((position) => position.x + MACRO_CARD_W + 200)),
      height: Math.max(700, ...positions.map((position) => position.y + MACRO_CARD_H + 200)),
    }
  }, [currentPositions])

  useEffect(() => {
    void loadPhases(projectId)
  }, [loadPhases, projectId])

  // Auto Layout action: cleanly aligns all phases into a standard DAG layout
  const handleAutoLayout = useCallback(() => {
    if (!canEdit) return
    Object.entries(layoutPositions).forEach(([id, pos]) => savePhasePosition(id, pos))
  }, [canEdit, layoutPositions, savePhasePosition])

  // Smooth dragging of Phase Cards
  const handleDragCardStart = useCallback(
    (e: React.MouseEvent, phaseId: string) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const phase = phases.find((p) => p.id === phaseId)
      if (!phase) return

      const startClientX = e.clientX
      const startClientY = e.clientY
      const initX = dragPhase?.id === phaseId ? dragPhase.x : (phase.x ?? layoutPositions[phaseId]?.x ?? 40)
      const initY = dragPhase?.id === phaseId ? dragPhase.y : (phase.y ?? layoutPositions[phaseId]?.y ?? 140)

      let isDragging = false
      let lastX = initX
      let lastY = initY

      const onMouseMove = (moveEv: MouseEvent) => {
        // Chỉ xem: không kéo được thẻ; thả chuột vẫn chọn phase như bấm thường
        if (!canEdit) return
        const dx = (moveEv.clientX - startClientX) / panZoom.scale
        const dy = (moveEv.clientY - startClientY) / panZoom.scale

        if (!isDragging && Math.hypot(dx, dy) > 8) {
          isDragging = true
        }

        if (isDragging) {
          lastX = Math.max(20, Math.round(initX + dx))
          lastY = Math.max(20, Math.round(initY + dy))
          setDragPhase({ id: phaseId, x: lastX, y: lastY })
        }
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)

        if (isDragging) {
          const blockClick = (clickEv: MouseEvent) => {
            clickEv.stopPropagation()
            clickEv.preventDefault()
            window.removeEventListener('click', blockClick, true)
          }
          window.addEventListener('click', blockClick, true)

          savePhasePosition(phaseId, { x: lastX, y: lastY })
          setDragPhase(null)
        } else {
          selectPhase(selectedPhaseId === phaseId ? null : phaseId)
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [canEdit, phases, dragPhase, layoutPositions, panZoom.scale, savePhasePosition, selectPhase, selectedPhaseId]
  )

  return (
    <section className={`relative flex h-full min-w-0 flex-col ${className}`}>
      {/* Top Header & Actions Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shrink-0 z-30 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Workflow Pipeline Engine</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {canEdit
              ? 'Macro Pipeline · Drag cards to reposition, scroll to zoom, connect from (+)'
              : `Macro Pipeline · Chế độ chỉ xem (${GRAPH_READ_ONLY_MESSAGE}) · Kéo nền để di chuyển, cuộn để zoom`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Phase Button */}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 disabled:active:scale-100"
            title={canEdit ? 'Add new phase to pipeline' : GRAPH_READ_ONLY_MESSAGE}
          >
            <Plus size={14} /> Add Phase
          </button>

          {/* Auto DAG Layout Button */}
          <button
            type="button"
            disabled={!canEdit}
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
            title={canEdit ? 'Auto-layout phases into a clean DAG' : GRAPH_READ_ONLY_MESSAGE}
          >
            <LayoutGrid size={13} className="text-slate-500" /> Auto Layout
          </button>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {phases.length} phases
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport with Pan & Zoom */}
      <div
        ref={panZoom.viewportRef}
        className="workflow-surface relative min-h-0 flex-1 overflow-hidden"
        onMouseDown={panZoom.onMouseDown}
        onMouseMove={panZoom.onMouseMove}
        onMouseUp={panZoom.onMouseUp}
        onMouseLeave={panZoom.onMouseLeave}
      >
        <div
          ref={panZoom.contentRef}
          className="relative"
          style={{ width: workflowSize.width, height: workflowSize.height, margin: 20, ...panZoom.transform }}
        >
          {/* SVG Connecting Edges */}
          <svg className="pointer-events-none absolute inset-0" width={workflowSize.width} height={workflowSize.height}>
            {workflowEdges.map(([from, to]) => (
              <WorkflowEdge
                key={`${from}-${to}`}
                a={phases.find((phase) => phase.id === from)}
                b={phases.find((phase) => phase.id === to)}
                positions={currentPositions}
                onDisconnect={canEdit ? (src, tgt) => void disconnectPhases(src, tgt).catch(handleError) : undefined}
              />
            ))}
          </svg>

          {/* Macro Phase Cards */}
          {phases.map((phase) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              position={currentPositions[phase.id] || { x: 40, y: 140 }}
              selected={selectedPhaseId === phase.id}
              onClick={() => selectPhase(selectedPhaseId === phase.id ? null : phase.id)}
              onSpawnDown={phaseConnect.onSpawnDown}
              onDragCardStart={handleDragCardStart}
              onDeletePhase={(id) => {
                const target = phases.find((p) => p.id === id)
                if (target) setPhaseToDelete(target)
              }}
              readOnly={!canEdit}
              readOnlyTitle={GRAPH_READ_ONLY_MESSAGE}
            />
          ))}
        </div>

        {/* Temporary Drag Line when connecting phases */}
        {phaseConnect.line && (
          <svg className="pointer-events-none fixed inset-0 z-50 h-screen w-screen">
            <line
              x1={phaseConnect.line.x1}
              y1={phaseConnect.line.y1}
              x2={phaseConnect.line.x2}
              y2={phaseConnect.line.y2}
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />
          </svg>
        )}

        {/* Error tooltip when connection is invalid / cyclic */}
        {phaseConnect.error && (
          <div
            className="fixed z-50 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xl animate-fade-in pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: phaseConnect.error.x, top: phaseConnect.error.y - 12 }}
          >
            {phaseConnect.error.message}
          </div>
        )}

        {/* Artifacts Hub Island & Drawer */}
        <div
          data-pan-zoom-ignore
          className="absolute top-4 right-6 z-40 flex items-center"
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="relative inline-block">
            <WorkflowArtifactsIsland />
            <WorkflowArtifactsDrawer projectId={projectId} />
          </div>
        </div>

        {/* Zoom Controls */}
        <div
          data-pan-zoom-ignore
          className="absolute bottom-6 right-6 z-20 flex items-center"
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <ZoomControls
            className="static"
            scale={panZoom.scale}
            onZoomIn={panZoom.zoomIn}
            onZoomOut={panZoom.zoomOut}
            onReset={panZoom.reset}
          />
        </div>
      </div>

      {/* Create Phase Modal */}
      {isCreateModalOpen && canEdit && (
        <CreatePhaseModal
          phases={phases}
          onSubmit={async (dto) => {
            await createPhase(dto)
            setIsCreateModalOpen(false)
          }}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* Confirm Delete Phase Modal */}
      <ConfirmDialog
        isOpen={phaseToDelete !== null}
        title="Delete phase?"
        message={`Phase "${phaseToDelete?.sub || phaseToDelete?.name || ''}" and all tasks inside it will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger={true}
        onConfirm={() => {
          if (phaseToDelete) {
            void deletePhase(phaseToDelete.id).catch(handleError)
            setPhaseToDelete(null)
          }
        }}
        onCancel={() => setPhaseToDelete(null)}
      />

      {/* B5: nối phase tạo vòng (backend trả 422) */}
      <KahnCycleModal violatingNodeIds={cycleNodes} onClose={closeCycleModal} />
    </section>
  )
}
