import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PhaseDto, PhaseEdgeDto, TemplateNodeDto } from '../../../../types/template.types';
import {
  calculatePhaseLayout,
  computeTopologicalPhaseRanks,
  PW,
  PHH,
} from '../../../../lib/graph/phaseLayout';
import { validateDag } from '../../../../lib/graph/kahn';
import { Plus, Trash2, ArrowUpRight, ZoomIn, ZoomOut, Maximize2, AlertCircle, X, LayoutGrid } from 'lucide-react';

interface PhaseCanvasProps {
  phases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  cyclePhaseIds: Set<string>;
  onOpenPhase: (phaseId: string) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddPhase: () => void;
  onAutoLayout?: () => void;
  onUpdatePhasePosition?: (phaseId: string, position: { x: number; y: number }) => void;
  onConnectPhases?: (sourceId: string, targetId: string) => void;
  onDisconnectPhases?: (sourceId: string, targetId: string) => void;
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
  onAutoLayout,
  onUpdatePhasePosition,
  onConnectPhases,
  onDisconnectPhases,
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
  const isSpawningRef = useRef(false);

  const handleAddPhase = useCallback(() => {
    if (isSpawningRef.current) return;
    isSpawningRef.current = true;
    onAddPhase();
    setTimeout(() => {
      isSpawningRef.current = false;
    }, 250);
  }, [onAddPhase]);

  const handleSpawnChild = useCallback(
    (sourceId: string) => {
      if (isSpawningRef.current) return;
      isSpawningRef.current = true;
      if (onSpawnChildPhase) {
        onSpawnChildPhase(sourceId);
      } else {
        onAddPhase();
      }
      setTimeout(() => {
        isSpawningRef.current = false;
      }, 250);
    },
    [onSpawnChildPhase, onAddPhase]
  );
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
        return {
          x: Number.isFinite(draggingCard.currX) ? draggingCard.currX : (draggingCard.origX ?? 0),
          y: Number.isFinite(draggingCard.currY) ? draggingCard.currY : (draggingCard.origY ?? 0),
        };
      }
      if (
        phase.uiMetadata?.position &&
        Number.isFinite(phase.uiMetadata.position.x) &&
        Number.isFinite(phase.uiMetadata.position.y)
      ) {
        return phase.uiMetadata.position;
      }
      const layoutPos = layout.positions.get(phase.id);
      if (layoutPos && Number.isFinite(layoutPos.x) && Number.isFinite(layoutPos.y)) {
        return { x: layoutPos.x, y: layoutPos.y };
      }
      return { x: 0, y: 0 };
    },
    [draggingCard, layout.positions]
  );

  // Fit view helper
  const handleFit = useCallback(() => {
    if (!containerRef.current || phases.length === 0) return;
    const w = containerRef.current.clientWidth || 1200;
    const h = containerRef.current.clientHeight || 700;
    const lw = Number.isFinite(layout.width) && layout.width > 0 ? layout.width : 1000;
    const lh = Number.isFinite(layout.height) && layout.height > 0 ? layout.height : 600;

    const scaleX = (w - 120) / lw;
    const scaleY = (h - 180) / lh;
    const validScale = Number.isFinite(scaleX) && Number.isFinite(scaleY) ? Math.min(scaleX, scaleY) : 1;
    const k = Math.min(1.5, Math.max(0.4, validScale));

    const x = Math.max(40, (w - lw * k) / 2);
    const y = Math.max(60, (h - lh * k) / 2);

    setView({
      x: Number.isFinite(x) ? x : 40,
      y: Number.isFinite(y) ? y : 60,
      k: Number.isFinite(k) && k > 0 ? k : 1,
    });
  }, [layout.width, layout.height, phases.length]);

  // Auto Layout action: neatly aligns all phases using calculated DAG layout
  const handleAutoLayout = useCallback(() => {
    if (onAutoLayout) {
      onAutoLayout();
    } else if (onUpdatePhasePosition) {
      phases.forEach((p) => {
        const pos = layout.positions.get(p.id);
        if (pos) {
          onUpdatePhasePosition(p.id, { x: pos.x, y: pos.y });
        }
      });
    }
    handleFit();
  }, [onAutoLayout, onUpdatePhasePosition, phases, layout.positions, handleFit]);

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
    const pan = panRef.current;
    if (pan) {
      const dx = e.clientX - pan.sx;
      const dy = e.clientY - pan.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        pan.moved = true;
      }
      const targetX = pan.vx + dx;
      const targetY = pan.vy + dy;
      setView((prev) => ({
        ...prev,
        x: Number.isFinite(targetX) ? targetX : prev.x,
        y: Number.isFinite(targetY) ? targetY : prev.y,
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
      // Guard against mouseup being swallowed or missed outside window
      if (e.buttons === 0 && (draggingCard || connectingLine)) {
        handleWindowMouseUp(e);
        return;
      }

      // 1. Handling Card Drag
      if (draggingCard) {
        const k = Number.isFinite(view.k) && view.k > 0 ? view.k : 1;
        const dx = (e.clientX - draggingCard.startClientX) / k;
        const dy = (e.clientY - draggingCard.startClientY) / k;
        const moved = draggingCard.moved || Math.hypot(dx, dy) > 4;
        if (moved) {
          cardMovedRef.current = true;
        }

        const validDx = Number.isFinite(dx) ? dx : 0;
        const validDy = Number.isFinite(dy) ? dy : 0;

        setDraggingCard((prev) =>
          prev
            ? {
                ...prev,
                currX: Math.max(0, Math.round(prev.origX + validDx)),
                currY: Math.max(0, Math.round(prev.origY + validDy)),
                moved,
              }
            : null
        );
      }

      // 2. Handling Drag-to-Connect wire
      if (connectingLine && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const k = Number.isFinite(view.k) && view.k > 0 ? view.k : 1;
        const vx = Number.isFinite(view.x) ? view.x : 0;
        const vy = Number.isFinite(view.y) ? view.y : 0;
        const worldX = (e.clientX - rect.left - vx) / k;
        const worldY = (e.clientY - rect.top - vy) / k;

        setConnectingLine((prev) =>
          prev
            ? {
                ...prev,
                currX: Number.isFinite(worldX) ? worldX : prev.startX,
                currY: Number.isFinite(worldY) ? worldY : prev.startY,
              }
            : null
        );
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      // 1. Finish Card Drag
      if (draggingCard) {
        if (draggingCard.moved) {
          cardMovedRef.current = true;
          window.setTimeout(() => {
            cardMovedRef.current = false;
          }, 80);

          const finalX = Number.isFinite(draggingCard.currX) ? draggingCard.currX : draggingCard.origX;
          const finalY = Number.isFinite(draggingCard.currY) ? draggingCard.currY : draggingCard.origY;
          if (onUpdatePhasePosition) {
            onUpdatePhasePosition(draggingCard.id, {
              x: finalX,
              y: finalY,
            });
          }
        } else {
          cardMovedRef.current = false;
        }
        setDraggingCard(null);
      }

      // 2. Finish Drag-to-Connect
      if (connectingLine) {
        const sourceId = connectingLine.sourcePhaseId;
        const targetEl = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-target-handle], [data-phase-id]');
        const targetId = targetEl?.dataset.targetHandle || targetEl?.dataset.phaseId;

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
          handleSpawnChild(sourceId);
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
    const phaseNodes = (nodes || []).filter((n) => n && n.phaseId === phaseId);
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
    let maxX = Number.isFinite(layout.width) ? layout.width : 1600;
    let maxY = Number.isFinite(layout.height) ? layout.height : 900;
    for (const p of phases) {
      const pos = getPhasePosition(p);
      if (Number.isFinite(pos.x)) maxX = Math.max(maxX, pos.x + PW + 200);
      if (Number.isFinite(pos.y)) maxY = Math.max(maxY, pos.y + PHH + 200);
    }
    return {
      width: Math.max(1600, Number.isFinite(maxX) ? maxX : 1600),
      height: Math.max(900, Number.isFinite(maxY) ? maxY : 900),
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
          {(phaseEdges || []).map((edge, idx) => {
            if (!edge || !edge.parentPhaseId || !edge.childPhaseId) return null;
            const parentPhase = (phases || []).find((p) => p && p.id === edge.parentPhaseId);
            const childPhase = (phases || []).find((p) => p && p.id === edge.childPhaseId);
            if (!parentPhase || !childPhase) return null;

            const posA = getPhasePosition(parentPhase);
            const posB = getPhasePosition(childPhase);

            const x1 = posA.x + PW;
            const y1 = posA.y + PHH / 2;
            const x2 = posB.x;
            const y2 = posB.y + PHH / 2;
            if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
              return null;
            }

            const dx = Math.max(60, Math.abs(x2 - x1) / 2);

            const isCyclic =
              (cyclePhaseIds?.has(edge.parentPhaseId) || false) &&
              (cyclePhaseIds?.has(edge.childPhaseId) || false);

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
          {connectingLine &&
            Number.isFinite(connectingLine.currX) &&
            Number.isFinite(connectingLine.currY) && (
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

        {/* Delete Edge Action Buttons at Midpoint of Curve */}
        {(phaseEdges || []).map((edge, idx) => {
          if (!edge || !edge.parentPhaseId || !edge.childPhaseId) return null;
          const parentPhase = (phases || []).find((p) => p && p.id === edge.parentPhaseId);
          const childPhase = (phases || []).find((p) => p && p.id === edge.childPhaseId);
          if (!parentPhase || !childPhase) return null;

          const posA = getPhasePosition(parentPhase);
          const posB = getPhasePosition(childPhase);

          const midX = (posA.x + PW + posB.x) / 2;
          const midY = (posA.y + PHH / 2 + posB.y + PHH / 2) / 2;
          if (!Number.isFinite(midX) || !Number.isFinite(midY)) {
            return null;
          }

          return (
            <div
              key={`edge-del-${edge.parentPhaseId}-${edge.childPhaseId}-${idx}`}
              style={{
                left: `${midX - 12}px`,
                top: `${midY - 12}px`,
              }}
              className="absolute z-20"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnectPhases?.(edge.parentPhaseId, edge.childPhaseId);
                }}
                title={`Xóa liên kết: ${parentPhase.name} ➔ ${childPhase.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-300 text-slate-400 opacity-70 transition-all hover:opacity-100 hover:scale-125 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-600 shadow-md"
              >
                <X className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
            </div>
          );
        })}

        {/* Macro Phase Cards (Light Blueprint Grid Style) */}
        {(phases || []).map((phase, idx) => {
          if (!phase || !phase.id) return null;
          const pos = getPhasePosition(phase);
          const stats = getPhaseStats(phase.id);
          const isBad = cyclePhaseIds?.has(phase.id) || false;
          const topoRank = topoRanks.get(phase.id) || idx + 1;
          const isBeingDragged = draggingCard?.id === phase.id;

          return (
            <div
              key={phase.id}
              data-phase-id={phase.id}
              onMouseDown={(e) => handleCardMouseDown(e, phase)}
              onClick={(e) => {
                e.stopPropagation();
                if (cardMovedRef.current) return;
                onOpenPhase(phase.id);
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

              {/* 1. TARGET HANDLE (Cổng vào mép trái): Nhận các mũi tên phụ thuộc tiền đề */}
              <div
                data-target-handle={phase.id}
                data-phase-id={phase.id}
                title={`Cổng vào: Nhận phụ thuộc cho ${phase.name}`}
                className={`absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${
                  connectingLine
                    ? 'scale-125 bg-blue-100 border-2 border-blue-600 ring-4 ring-blue-400/50 animate-pulse cursor-crosshair'
                    : 'bg-white border-2 border-slate-300 text-slate-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 shadow-sm'
                }`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    connectingLine ? 'bg-blue-600' : 'bg-slate-400 group-hover:bg-blue-500'
                  }`}
                />
              </div>

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

              {/* 2. SOURCE HANDLE (Cổng ra mép phải / Nút +): Click tạo phase con, Kéo nối dây sang phase khác */}
              <button
                type="button"
                onMouseDown={(e) => handleStartConnect(e, phase.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                title="Kéo sang Cổng vào (mép trái) Phase khác để nối dây · Click để tạo nhanh Phase con nối tiếp"
                className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md border-2 border-white transition-all hover:bg-blue-700 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
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

      {/* Floating: Action Buttons (Add Phase + Auto Layout) */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddPhase}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Phase</span>
        </button>

        <button
          type="button"
          onClick={handleAutoLayout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
          title="Auto-layout phases into a clean DAG (Sắp xếp tự động)"
        >
          <LayoutGrid className="h-4 w-4 text-slate-500" />
          <span>Auto Layout</span>
        </button>
      </div>

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
