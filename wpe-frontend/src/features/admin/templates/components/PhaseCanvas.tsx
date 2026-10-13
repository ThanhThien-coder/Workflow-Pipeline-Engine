import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PhaseDto, PhaseEdgeDto, TemplateNodeDto } from '../../../../types/template.types';
import {
  calculatePhaseLayout,
  computeTopologicalPhaseRanks,
  PW,
  PHH,
} from '../../../../lib/graph/phaseLayout';
import { validateDag } from '../../../../lib/graph/kahn';
import { Plus, Trash2, ArrowUpRight, ZoomIn, ZoomOut, Maximize2, AlertCircle } from 'lucide-react';

interface PhaseCanvasProps {
  phases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  cyclePhaseIds: Set<string>;
  onOpenPhase: (phaseId: string) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddPhase: () => void;
  onUpdatePhasePosition?: (phaseId: string, position: { x: number; y: number }) => void;
  onConnectPhases?: (sourceId: string, targetId: string) => void;
  onSpawnChildPhase?: (sourceId: string) => void;
}

export const PhaseCanvas: React.FC<PhaseCanvasProps> = ({
  phases,
  phaseEdges,
  nodes,
  cyclePhaseIds,
  onOpenPhase,
  onDeletePhase,
  onAddPhase,
  onUpdatePhasePosition,
  onConnectPhases,
  onSpawnChildPhase,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom View State
  const [view, setView] = useState<{ x: number; y: number; k: number }>({
    x: 60,
    y: 80,
    k: 1,
  });

  const [isGrabbing, setIsGrabbing] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(
    null
  );

  // Drag-and-drop Card positioning state
  const [draggingCard, setDraggingCard] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    currX: number;
    currY: number;
    moved: boolean;
  } | null>(null);

  // Drag-to-connect dependency line state
  const [connectingLine, setConnectingLine] = useState<{
    sourcePhaseId: string;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const [connectError, setConnectError] = useState<{
    message: string;
    x: number;
    y: number;
  } | null>(null);

  const cardMovedRef = useRef(false);

  // Compute Layout positions
  const layout = useMemo(() => {
    return calculatePhaseLayout(phases, phaseEdges);
  }, [phases, phaseEdges]);

  // Compute 1-based Topological Sort order for Phase sequence badges (SSOT Invariant)
  const topoRanks = useMemo(() => {
    return computeTopologicalPhaseRanks(phases, phaseEdges);
  }, [phases, phaseEdges]);

  // Resolve active position for each Phase (user-dragged position > uiMetadata > layout)
  const getPhasePosition = useCallback(
    (phase: PhaseDto): { x: number; y: number } => {
      if (draggingCard && draggingCard.id === phase.id) {
        return { x: draggingCard.currX, y: draggingCard.currY };
      }
      if (
        phase.uiMetadata?.position &&
        typeof phase.uiMetadata.position.x === 'number' &&
        typeof phase.uiMetadata.position.y === 'number'
      ) {
        return phase.uiMetadata.position;
      }
      const layoutPos = layout.positions.get(phase.id);
      if (layoutPos) {
        return { x: layoutPos.x, y: layoutPos.y };
      }
      return { x: 0, y: 0 };
    },
    [draggingCard, layout.positions]
  );

  // Fit view helper
  const handleFit = useCallback(() => {
    if (!containerRef.current || phases.length === 0) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const scaleX = (w - 120) / layout.width;
    const scaleY = (h - 180) / layout.height;
    const k = Math.min(1.5, Math.max(0.4, Math.min(scaleX, scaleY)));

    const x = Math.max(40, (w - layout.width * k) / 2);
    const y = Math.max(60, (h - layout.height * k) / 2);

    setView({ x, y, k });
  }, [layout.width, layout.height, phases.length]);

  // Initial fit on mount
  useEffect(() => {
    handleFit();
  }, [handleFit]);

  // Zoom at point
  const zoomAt = (cx: number, cy: number, factor: number) => {
    setView((v) => {
      const newK = Math.min(2, Math.max(0.4, v.k * factor));
      const ratio = newK / v.k;
      const newX = cx - (cx - v.x) * ratio;
      const newY = cy - (cy - v.y) * ratio;
      return { x: newX, y: newY, k: newK };
    });
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(cx, cy, factor);
  };

  // Mouse pan handlers (Canvas background)
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-phase-id]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
    };
    setIsGrabbing(true);
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.sx;
      const dy = e.clientY - panRef.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        panRef.current.moved = true;
      }
      setView((prev) => ({
        ...prev,
        x: panRef.current!.vx + dx,
        y: panRef.current!.vy + dy,
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    panRef.current = null;
    setIsGrabbing(false);
  };

  // Card Dragging Handlers
  const handleCardMouseDown = (e: React.MouseEvent, phase: PhaseDto) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    cardMovedRef.current = false;

    const pos = getPhasePosition(phase);
    setDraggingCard({
      id: phase.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      currX: pos.x,
      currY: pos.y,
      moved: false,
    });
  };

  // Window-level listeners for card drag & connect drag
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      // 1. Handling Card Drag
      if (draggingCard) {
        const dx = (e.clientX - draggingCard.startClientX) / view.k;
        const dy = (e.clientY - draggingCard.startClientY) / view.k;
        const moved = draggingCard.moved || Math.hypot(dx, dy) > 4;
        if (moved) {
          cardMovedRef.current = true;
        }

        setDraggingCard((prev) =>
          prev
            ? {
                ...prev,
                currX: Math.max(0, Math.round(prev.origX + dx)),
                currY: Math.max(0, Math.round(prev.origY + dy)),
                moved,
              }
            : null
        );
      }

      // 2. Handling Drag-to-Connect wire
      if (connectingLine && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - view.x) / view.k;
        const worldY = (e.clientY - rect.top - view.y) / view.k;

        setConnectingLine((prev) =>
          prev
            ? {
                ...prev,
                currX: worldX,
                currY: worldY,
              }
            : null
        );
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      // 1. Finish Card Drag
      if (draggingCard) {
        if (draggingCard.moved) {
          if (onUpdatePhasePosition) {
            onUpdatePhasePosition(draggingCard.id, {
              x: draggingCard.currX,
              y: draggingCard.currY,
            });
          }
          setTimeout(() => {
            cardMovedRef.current = false;
          }, 100);
        }
        setDraggingCard(null);
      }

      // 2. Finish Drag-to-Connect
      if (connectingLine) {
        const sourceId = connectingLine.sourcePhaseId;
        const targetEl = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-phase-id]');
        const targetId = targetEl?.dataset.phaseId;

        const flashError = (message: string) => {
          setConnectError({ message, x: e.clientX, y: e.clientY });
          window.setTimeout(() => setConnectError(null), 2200);
        };

        const distanceMoved = Math.hypot(
          connectingLine.currX - connectingLine.startX,
          connectingLine.currY - connectingLine.startY
        );

        if (distanceMoved < 6) {
          // User just clicked the connector button -> spawn new child phase
          if (onSpawnChildPhase) {
            onSpawnChildPhase(sourceId);
          } else {
            onAddPhase();
          }
        } else if (targetId && targetId !== sourceId) {
          // Check if connection already exists
          const exists = phaseEdges.some(
            (edge) => edge.parentPhaseId === sourceId && edge.childPhaseId === targetId
          );
          if (exists) {
            flashError('Liên kết giữa 2 Phase này đã tồn tại!');
          } else {
            // Check cycle using Kahn's algorithm before adding edge
            const testEdges: [string, string][] = [
              ...phaseEdges.map((ed) => [ed.parentPhaseId, ed.childPhaseId] as [string, string]),
              [sourceId, targetId],
            ];
            const testRes = validateDag(
              phases.map((p) => p.id),
              testEdges
            );
            if (!testRes.valid) {
              flashError('Không thể nối: phát hiện chu trình lặp (Cycle Detected)!');
            } else if (onConnectPhases) {
              onConnectPhases(sourceId, targetId);
            }
          }
        }

        setConnectingLine(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [
    draggingCard,
    connectingLine,
    view.k,
    view.x,
    view.y,
    phases,
    phaseEdges,
    onUpdatePhasePosition,
    onOpenPhase,
    onConnectPhases,
    onSpawnChildPhase,
    onAddPhase,
  ]);

  // Start drag-to-connect from phase right handle
  const handleStartConnect = (e: React.MouseEvent, phaseId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;

    const pos = getPhasePosition(phase);
    const startX = pos.x + PW;
    const startY = pos.y + PHH / 2;

    setConnectingLine({
      sourcePhaseId: phaseId,
      startX,
      startY,
      currX: startX,
      currY: startY,
    });
  };

  // Helper to count tracks and tasks in a phase
  const getPhaseStats = (phaseId: string) => {
    const phaseNodes = nodes.filter((n) => n.phaseId === phaseId);
    let tracks = 0;
    let tasks = 0;
    for (const n of phaseNodes) {
      if (n.level === 1) tracks++;
      if (n.level >= 2) tasks++;
    }
    return { tracks, tasks };
  };

  // Canvas bounds computed dynamically
  const canvasBounds = useMemo(() => {
    let maxX = layout.width;
    let maxY = layout.height;
    for (const p of phases) {
      const pos = getPhasePosition(p);
      maxX = Math.max(maxX, pos.x + PW + 200);
      maxY = Math.max(maxY, pos.y + PHH + 200);
    }
    return {
      width: Math.max(1600, maxX),
      height: Math.max(900, maxY),
    };
  }, [layout.width, layout.height, phases, getPhasePosition]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      onMouseLeave={handleMouseUpCanvas}
      className={`relative flex-1 overflow-hidden select-none admin-grid-bg ${
        isGrabbing ? 'cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* World transform viewport */}
      <div
        className="absolute left-0 top-0 origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
        }}
      >
        {/* SVG Bezier Curves connecting phases */}
        <svg
          width={canvasBounds.width + 600}
          height={canvasBounds.height + 600}
          className="absolute left-0 top-0 overflow-visible pointer-events-none"
        >
          <defs>
            <marker
              id="phase-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill="#2563eb" />
            </marker>
            <marker
              id="phase-arrow-bad"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill="#ef4444" />
            </marker>
          </defs>

          {/* Render static/persisted edges */}
          {phaseEdges.map((edge, idx) => {
            const parentPhase = phases.find((p) => p.id === edge.parentPhaseId);
            const childPhase = phases.find((p) => p.id === edge.childPhaseId);
            if (!parentPhase || !childPhase) return null;

            const posA = getPhasePosition(parentPhase);
            const posB = getPhasePosition(childPhase);

            const x1 = posA.x + PW;
            const y1 = posA.y + PHH / 2;
            const x2 = posB.x;
            const y2 = posB.y + PHH / 2;
            const dx = Math.max(60, Math.abs(x2 - x1) / 2);

            const isCyclic =
              cyclePhaseIds.has(edge.parentPhaseId) &&
              cyclePhaseIds.has(edge.childPhaseId);

            return (
              <path
                key={`edge-${edge.parentPhaseId}-${edge.childPhaseId}-${idx}`}
                d={`M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isCyclic ? '#ef4444' : '#2563eb'}
                strokeWidth={2.5}
                strokeDasharray={isCyclic ? '6 6' : undefined}
                markerEnd={isCyclic ? 'url(#phase-arrow-bad)' : 'url(#phase-arrow)'}
              />
            );
          })}

          {/* Render live Drag-to-Connect wire */}
          {connectingLine && (
            <path
              d={`M${connectingLine.startX} ${connectingLine.startY} C${
                connectingLine.startX +
                Math.max(50, Math.abs(connectingLine.currX - connectingLine.startX) / 2)
              } ${connectingLine.startY}, ${
                connectingLine.currX -
                Math.max(50, Math.abs(connectingLine.currX - connectingLine.startX) / 2)
              } ${connectingLine.currY}, ${connectingLine.currX} ${connectingLine.currY}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth={3}
              strokeDasharray="6 6"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Macro Phase Cards (Light Blueprint Grid Style) */}
        {phases.map((phase, idx) => {
          const pos = getPhasePosition(phase);
          const stats = getPhaseStats(phase.id);
          const isBad = cyclePhaseIds.has(phase.id);
          const topoRank = topoRanks.get(phase.id) || idx + 1;
          const isBeingDragged = draggingCard?.id === phase.id;

          return (
            <div
              key={phase.id}
              data-phase-id={phase.id}
              onMouseDown={(e) => handleCardMouseDown(e, phase)}
              onClick={(e) => {
                e.stopPropagation();
                if (!cardMovedRef.current) {
                  onOpenPhase(phase.id);
                }
              }}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${PW}px`,
                height: `${PHH}px`,
              }}
              className={`group absolute rounded-2xl border bg-white shadow-sm transition-shadow duration-200 select-none ${
                isBeingDragged ? 'z-30 shadow-2xl ring-2 ring-blue-500 cursor-grabbing' : 'cursor-grab hover:shadow-lg'
              } ${
                isBad
                  ? 'border-rose-400 ring-2 ring-rose-200'
                  : 'border-slate-200/90 hover:border-blue-400'
              }`}
            >
              {/* Top Accent Bar */}
              <div
                className={`h-1.5 w-full rounded-t-2xl transition-colors ${
                  isBad
                    ? 'bg-rose-500'
                    : topoRank === 1
                    ? 'bg-emerald-500'
                    : 'bg-blue-600'
                }`}
              />

              <div className="p-4 flex flex-col h-[calc(100%-6px)] justify-between">
                {/* Header: Topological Sort Badge & Delete */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-blue-700 uppercase border border-blue-100">
                    Phase {topoRank}
                  </span>

                  {phases.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePhase(phase.id);
                      }}
                      title="Delete phase"
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Phase Semantic Name */}
                <div
                  className="font-bold text-slate-900 leading-snug line-clamp-1 mt-1 text-sm"
                  title={phase.name}
                >
                  {phase.name}
                </div>

                {/* Subtitle / Counts */}
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>{stats.tracks} tracks</span>
                  <span>•</span>
                  <span>{stats.tasks} tasks</span>
                </div>

                {/* Bottom footer status */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span
                    className={
                      isBad
                        ? 'font-semibold text-rose-600 flex items-center gap-1'
                        : 'text-slate-400 font-medium'
                    }
                  >
                    {isBad ? (
                      <>
                        <AlertCircle className="h-3 w-3 inline" />
                        In cycle
                      </>
                    ) : (
                      'Click to design'
                    )}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-blue-600 hover:text-blue-700">
                    <span>Inspect</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* Connector Handle on Right Edge: Click to Spawn, Drag to Connect */}
              <button
                type="button"
                onMouseDown={(e) => handleStartConnect(e, phase.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                title="Kéo sang Phase khác để nối phụ thuộc · Bấm để tạo Phase con"
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:scale-110 active:scale-95 group-hover:opacity-100 opacity-0 cursor-grab active:cursor-grabbing"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Connection Error Toast Overlay */}
      {connectError && (
        <div
          className="pointer-events-none fixed z-[70] rounded-xl bg-slate-900/95 px-3.5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-sm border border-slate-700 animate-fade"
          style={{ left: connectError.x + 12, top: connectError.y + 12 }}
        >
          {connectError.message}
        </div>
      )}

      {/* Floating: Add New Phase Button */}
      <button
        type="button"
        onClick={onAddPhase}
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95"
      >
        <Plus className="h-4 w-4" />
        <span>Add New Phase</span>
      </button>

      {/* Floating: Navigation Hint */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
        <span>Kéo nền để Pan · Cuộn để Zoom · Kéo Card để sắp xếp · Kéo nút (+) để nối dây</span>
      </div>

      {/* Floating: Zoom Controls Toolbar */}
      <div className="absolute left-4 bottom-4 z-10 flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-md">
        <button
          type="button"
          onClick={() => {
            if (!containerRef.current) return;
            zoomAt(
              containerRef.current.clientWidth / 2,
              containerRef.current.clientHeight / 2,
              1 / 1.2
            );
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <span className="w-12 text-center text-xs font-bold text-slate-700 select-none">
          {Math.round(view.k * 100)}%
        </span>

        <button
          type="button"
          onClick={() => {
            if (!containerRef.current) return;
            zoomAt(
              containerRef.current.clientWidth / 2,
              containerRef.current.clientHeight / 2,
              1.2
            );
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        <button
          type="button"
          onClick={handleFit}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
          title="Fit View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
};
