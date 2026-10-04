import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { usePanZoom } from '../../hooks/usePanZoom'
import { CreatePhaseModal } from './CreatePhaseModal'
import { WorkflowEdge } from './WorkflowEdge'
import { PhaseCard } from './PhaseCard'
import { ZoomControls } from '../mindmap/ZoomControls'
import { usePhaseConnectDrag } from '../../hooks/usePhaseConnectDrag'
import { computeMacroGraphLayout, MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'

export function MacroWorkflow({ className = '' }: { className?: string }) {
  const phases = useWorkflowStore((state) => state.macroPhases)
  const workflowEdges = useWorkflowStore((state) => state.workflowEdges)
  const selectedPhaseId = useWorkflowStore((state) => state.selectedPhaseId)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  const createPhase = useWorkflowStore((state) => state.createPhase)
  const spawnChildPhase = useWorkflowStore((state) => state.spawnChildPhase)
  const connectPhases = useWorkflowStore((state) => state.connectPhases)
  const selectPhase = useWorkflowStore((state) => state.selectPhase)
  const panZoom = usePanZoom()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const phaseConnect = usePhaseConnectDrag(phases, connectPhases, spawnChildPhase)
  const phaseRecord = useMemo(() => phases.reduce<Record<string, typeof phases[number]>>((record, phase) => ({ ...record, [phase.id]: phase }), {}), [phases])
  const layoutPositions = useMemo(() => computeMacroGraphLayout(phaseRecord), [phaseRecord])
  const workflowSize = useMemo(() => {
    const positions = Object.values(layoutPositions)
    return {
      width: Math.max(1600, ...positions.map((position) => position.x + MACRO_CARD_W + 100)),
      height: Math.max(520, ...positions.map((position) => position.y + MACRO_CARD_H + 100)),
    }
  }, [layoutPositions])
  useEffect(() => { void loadPhases() }, [loadPhases])
  return <section className={`relative flex h-full min-w-0 flex-col ${className}`}>
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shrink-0"><div><div className="text-sm font-semibold text-slate-800">Workflow Pipeline Engine</div><div className="text-[11px] text-slate-400">Macro Pipeline · kéo nền để di chuyển, lăn chuột để zoom</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{phases.length} clusters</span></div>
    <div ref={panZoom.viewportRef} className="workflow-surface relative min-h-0 flex-1 overflow-hidden" onMouseDown={panZoom.onMouseDown} onMouseMove={panZoom.onMouseMove} onMouseUp={panZoom.onMouseUp} onMouseLeave={panZoom.onMouseLeave}>
        <div ref={panZoom.contentRef} className="relative" style={{ width: workflowSize.width, height: workflowSize.height, margin: 20, ...panZoom.transform }}>
          <svg className="pointer-events-none absolute inset-0" width={workflowSize.width} height={workflowSize.height}>{workflowEdges.map(([from, to]) => <WorkflowEdge key={`${from}-${to}`} a={phases.find((phase) => phase.id === from)} b={phases.find((phase) => phase.id === to)} positions={layoutPositions} />)}</svg>
        {phases.map((phase) => <PhaseCard key={phase.id} phase={phase} position={layoutPositions[phase.id] || { x: phase.x, y: phase.y }} selected={selectedPhaseId === phase.id} onClick={() => selectPhase(selectedPhaseId === phase.id ? null : phase.id)} onSpawnDown={phaseConnect.onSpawnDown} />)}
      </div>
      {phaseConnect.line && <svg className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"><line x1={phaseConnect.line.x1} y1={phaseConnect.line.y1} x2={phaseConnect.line.x2} y2={phaseConnect.line.y2} stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6 5" /></svg>}
      {phaseConnect.error && <div className="pointer-events-none fixed z-[60] rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg" style={{ left: phaseConnect.error.x, top: phaseConnect.error.y }}>{phaseConnect.error.message}</div>}
      <div data-pan-zoom-ignore className="absolute bottom-6 right-6 z-30 flex items-center gap-3" onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <ZoomControls className="static" scale={panZoom.scale} onZoomIn={panZoom.zoomIn} onZoomOut={panZoom.zoomOut} onReset={panZoom.reset} />
        <button onMouseDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()} onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition-shadow hover:bg-indigo-700 hover:shadow-2xl" aria-label="Tạo Phase mới"><Plus size={17} />Tạo Phase mới</button>
      </div>
    </div>
    {showCreateModal && <CreatePhaseModal phases={phases} onSubmit={createPhase} onClose={() => setShowCreateModal(false)} />}
  </section>
}
