import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Plus, LayoutGrid, AlertTriangle } from 'lucide-react'
import { GRAPH_READ_ONLY_MESSAGE, selectCanEditGraph, useWorkflowStore } from '../../store/useWorkflowStore'
import type { MacroPhase } from '../../types/workflow.types'
import { KahnCycleModal } from '../settings/KahnCycleModal'
import { useGraphErrorHandler } from './useGraphErrorHandler'
import { isApiError } from '../../services/http/ApiError'
import { usePanZoom } from '../../hooks/usePanZoom'
import { EDGE_ARROW_ACTIVE_ID, EDGE_ARROW_ID, WorkflowEdge } from './WorkflowEdge'
import { PhaseCard } from './PhaseCard'
import { CreatePhaseModal } from './CreatePhaseModal'
import { ConfirmDialog } from '../../features/admin/templates/components/ConfirmDialog'
import { ZoomControls } from '../mindmap/ZoomControls'
import { usePhaseConnectDrag } from '../../hooks/usePhaseConnectDrag'
import { computeMacroGraphLayout, MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'
import { arrangePhases, autoLayoutColumns, channelOffsets, columnX, phaseColumns, routeEdge } from '../../utils/phaseColumnLayout'
import { WorkflowArtifactsIsland } from '../workspace/WorkflowArtifactsIsland'
import { WorkflowArtifactsDrawer } from '../workspace/WorkflowArtifactsDrawer'
import { ProjectStatusControl } from './ProjectStatusControl'
import { pluralize } from '../../utils/pluralize'
import { phaseDisplayName } from '../../utils/phaseName'

/** Lớp nội dung canvas có margin 20: fit phải bù khoảng lệch này. */
const CONTENT_MARGIN = 20

export function MacroWorkflow({ projectId = '1', className = '' }: { projectId?: string; className?: string }) {
  const phases = useWorkflowStore((state) => state.macroPhases)
  const workflowEdges = useWorkflowStore((state) => state.workflowEdges)
  const selectedPhaseId = useWorkflowStore((state) => state.selectedPhaseId)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  const graphStatus = useWorkflowStore((state) => state.graphStatus)
  const graphError = useWorkflowStore((state) => state.graphError)
  const loadArtifacts = useWorkflowStore((state) => state.artifacts.loadArtifacts)
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
  const columns = useMemo(() => phaseColumns(phases), [phases])

  // T5: x theo cột của DAG; y theo vị trí đã lưu (chưa lưu thì bố cục tự động), tự tránh đè thẻ cùng cột.
  // Thẻ đang kéo đi theo chuột, các thẻ khác cùng cột tự dồn chỗ.
  const currentPositions = useMemo(() => {
    const preferredY: Record<string, number> = {}
    phases.forEach((p) => {
      preferredY[p.id] = dragPhase?.id === p.id ? dragPhase.y : p.y ?? layoutPositions[p.id]?.y ?? 60
    })
    const arranged = arrangePhases(phases, preferredY)
    if (dragPhase && arranged[dragPhase.id]) arranged[dragPhase.id] = { x: dragPhase.x, y: dragPhase.y }
    return arranged
  }, [phases, dragPhase, layoutPositions])

  // Phase đang được chú ý (rê chuột ưu tiên hơn đang chọn): dây ra/vào nó nổi lên, dây khác mờ đi
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null)
  const focusPhaseId = hoveredPhaseId ?? selectedPhaseId

  const edgeRoutes = useMemo(() => {
    const offsets = channelOffsets(workflowEdges, currentPositions, columns)
    return workflowEdges
      .filter(([from, to]) => currentPositions[from] && currentPositions[to])
      .map(([from, to]) => {
        const middle = phases
          .filter((p) => columns[p.id] > columns[from] && columns[p.id] < columns[to])
          .map((p) => currentPositions[p.id])
        return { from, to, route: routeEdge(currentPositions[from], currentPositions[to], columns[from], columns[to], middle, offsets[from]) }
      })
  }, [workflowEdges, currentPositions, columns, phases])

  const workflowSize = useMemo(() => {
    const positions = Object.values(currentPositions)
    return {
      width: Math.max(1800, ...positions.map((position) => position.x + MACRO_CARD_W + 200)),
      height: Math.max(700, ...positions.map((position) => position.y + MACRO_CARD_H + 200)),
    }
  }, [currentPositions])

  // Khung bao mọi thẻ đang hiện (tọa độ lớp nội dung, chưa scale)
  const contentBounds = useMemo(() => {
    const positions = Object.values(currentPositions)
    if (positions.length === 0) return null
    return {
      minX: Math.min(...positions.map((pos) => pos.x)),
      minY: Math.min(...positions.map((pos) => pos.y)),
      maxX: Math.max(...positions.map((pos) => pos.x + MACRO_CARD_W)),
      maxY: Math.max(...positions.map((pos) => pos.y + MACRO_CARD_H)),
    }
  }, [currentPositions])
  const boundsRef = useRef(contentBounds)
  boundsRef.current = contentBounds

  const { fitToBounds } = panZoom
  const handleFit = useCallback(() => {
    fitToBounds(boundsRef.current, { padding: 48, maxScale: 1, contentOffset: { x: CONTENT_MARGIN, y: CONTENT_MARGIN } })
  }, [fitToBounds])

  // Tự fit MỘT lần mỗi lần vào dự án, sau khi tải xong và có ít nhất 1 phase (không fit lại khi dữ liệu đổi).
  // Chỉ tính sau khi đã thấy trạng thái loading của dự án này, để không fit nhầm dữ liệu cũ của dự án trước.
  const autoFit = useRef({ projectId, sawLoading: false, done: false })
  if (autoFit.current.projectId !== projectId) autoFit.current = { projectId, sawLoading: false, done: false }
  const hasPhases = phases.length > 0
  useEffect(() => {
    const state = autoFit.current
    if (graphStatus === 'loading') state.sawLoading = true
    if (state.done || !state.sawLoading || graphStatus !== 'ready' || !hasPhases) return
    let frame = 0
    let tries = 0
    const attempt = () => {
      const ok = fitToBounds(boundsRef.current, {
        padding: 48,
        maxScale: 1,
        contentOffset: { x: CONTENT_MARGIN, y: CONTENT_MARGIN },
      })
      if (ok) {
        state.done = true
      } else if (++tries < 120) {
        frame = requestAnimationFrame(attempt) // khung nhìn chưa có kích thước, thử lại ở frame sau
      }
    }
    attempt()
    return () => cancelAnimationFrame(frame)
  }, [graphStatus, hasPhases, projectId, fitToBounds])

  useEffect(() => {
    void loadPhases(projectId)
    // Số trên nút Artifacts phải đúng ngay khi mở dự án, không chờ mở drawer
    void loadArtifacts(projectId)
  }, [loadPhases, loadArtifacts, projectId])

  // Auto Layout: giữ cột theo DAG, sắp lại thứ tự trong từng cột cho ít dây cắt nhau, rồi lưu
  const handleAutoLayout = useCallback(() => {
    if (!canEdit) return
    const currentY = Object.fromEntries(Object.entries(currentPositions).map(([id, pos]) => [id, pos.y]))
    Object.entries(autoLayoutColumns(phases, currentY)).forEach(([id, pos]) => savePhasePosition(id, pos))
  }, [canEdit, currentPositions, phases, savePhasePosition])

  // Smooth dragging of Phase Cards
  const handleDragCardStart = useCallback(
    (e: React.MouseEvent, phaseId: string) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const phase = phases.find((p) => p.id === phaseId)
      if (!phase) return

      const startClientX = e.clientX
      const startClientY = e.clientY
      const initX = currentPositions[phaseId]?.x ?? columnX(columns[phaseId] ?? 0)
      const initY = currentPositions[phaseId]?.y ?? 60

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

          // Thả ra thì bám về cột của phase, chỉ giữ thứ tự trên–dưới
          savePhasePosition(phaseId, { x: columnX(columns[phaseId] ?? 0), y: lastY })
          setDragPhase(null)
        } else {
          selectPhase(selectedPhaseId === phaseId ? null : phaseId)
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [canEdit, phases, currentPositions, columns, panZoom.scale, savePhasePosition, selectPhase, selectedPhaseId]
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
              : `Macro Pipeline · Read-only (${GRAPH_READ_ONLY_MESSAGE}) · Drag the canvas to pan, scroll to zoom`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Trạng thái dự án + nút Start project (chỉ chủ dự án) */}
          <div data-pan-zoom-ignore>
            <ProjectStatusControl projectId={projectId} />
          </div>
          <span className="h-5 w-px bg-slate-200" aria-hidden />

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

          {/* Artifacts: nút trong header, bảng artifact mở ngay dưới nút */}
          <div data-pan-zoom-ignore className="relative">
            <WorkflowArtifactsIsland />
            <WorkflowArtifactsDrawer projectId={projectId} />
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {pluralize(phases.length, 'phase')}
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport with Pan & Zoom */}
      <div
        ref={panZoom.viewportRef}
        className="workflow-surface relative min-h-0 flex-1 overflow-hidden"
        onScroll={(event) => {
          // Khung nhìn chỉ di chuyển bằng pan/zoom; trình duyệt tự cuộn (kéo chọn chữ, focus) làm Fit lệch và nút zoom trôi đi
          event.currentTarget.scrollTop = 0
          event.currentTarget.scrollLeft = 0
        }}
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
            <defs>
              <marker id={EDGE_ARROW_ID} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
              </marker>
              <marker id={EDGE_ARROW_ACTIVE_ID} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#4f46e5" />
              </marker>
            </defs>
            {edgeRoutes.map(({ from, to, route }) => (
              <WorkflowEdge
                key={`${from}-${to}`}
                sourceId={from}
                targetId={to}
                route={route}
                highlight={!focusPhaseId ? 'normal' : from === focusPhaseId || to === focusPhaseId ? 'on' : 'dim'}
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
              onRenameError={handleError}
              onHoverChange={(hovered) =>
                setHoveredPhaseId((current) => (hovered ? phase.id : current === phase.id ? null : current))
              }
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

        {/* Trạng thái tải: khung chờ / lỗi + Retry / dự án chưa có phase */}
        {graphStatus === 'loading' && !hasPhases && (
          <div
            data-pan-zoom-ignore
            role="status"
            aria-label="Loading phases"
            className="absolute inset-0 z-10 flex items-start gap-12 overflow-hidden p-10"
          >
            {[0, 1, 2].map((col) => (
              <div key={col} className="flex flex-col gap-10" style={{ marginTop: col * 40 }}>
                {Array.from({ length: col === 1 ? 2 : 1 }).map((_, row) => (
                  <div
                    key={row}
                    data-skeleton-card
                    className="animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                    style={{ width: MACRO_CARD_W, height: MACRO_CARD_H }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {graphStatus === 'error' && (
          <div
            data-pan-zoom-ignore
            role="alert"
            className="absolute left-1/2 top-4 z-20 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 shadow-md"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span className="min-w-0 break-words">{graphError || 'Failed to load the graph'}</span>
            <button
              type="button"
              onClick={() => void loadPhases(projectId)}
              className="shrink-0 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        )}

        {graphStatus === 'ready' && !hasPhases && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <p className="rounded-xl bg-white/80 px-4 py-2 text-sm text-slate-500">
              No phases yet — click Add Phase
            </p>
          </div>
        )}

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
            onFit={handleFit}
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
        message={`Phase "${phaseDisplayName(phaseToDelete)}" and the tasks inside it that haven't started will be deleted, and its dependency links will be removed. Artifacts stay in the project library. A phase with started or completed tasks can't be deleted.`}
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
