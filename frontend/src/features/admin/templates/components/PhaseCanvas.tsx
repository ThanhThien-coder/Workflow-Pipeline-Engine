import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PhaseDto, PhaseEdgeDto, TemplateNodeDto } from '../../../../types/template.types';
import { calculatePhaseLayout, PW, PHH } from '../../../../lib/graph/phaseLayout';
import { Plus, Trash2, ArrowUpRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface PhaseCanvasProps {
  phases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  cyclePhaseIds: Set<string>;
  onOpenPhase: (phaseId: string) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddPhase: () => void;
}

export const PhaseCanvas: React.FC<PhaseCanvasProps> = ({
  phases,
  phaseEdges,
  nodes,
  cyclePhaseIds,
  onOpenPhase,
  onDeletePhase,
  onAddPhase,
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

  // Compute Layout positions
  const layout = React.useMemo(() => {
    return calculatePhaseLayout(phases, phaseEdges);
  }, [phases, phaseEdges]);

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

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
    };
    setIsGrabbing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panRef.current) return;
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
  };

  const handleMouseUp = () => {
    panRef.current = null;
    setIsGrabbing(false);
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

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative flex-1 overflow-hidden select-none admin-grid-bg ${
        isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
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
          width={layout.width + 600}
          height={layout.height + 600}
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
              <path d="M0 0L10 5L0 10z" fill="#6366f1" />
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

          {phaseEdges.map((edge, idx) => {
            const posA = layout.positions.get(edge.parentPhaseId);
            const posB = layout.positions.get(edge.childPhaseId);
            if (!posA || !posB) return null;

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
                key={`edge-${idx}`}
                d={`M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isCyclic ? '#ef4444' : '#6366f1'}
                strokeWidth={2.5}
                markerEnd={isCyclic ? 'url(#phase-arrow-bad)' : 'url(#phase-arrow)'}
              />
            );
          })}
        </svg>

        {/* Phase Cards */}
        {phases.map((phase, idx) => {
          const pos = layout.positions.get(phase.id);
          if (!pos) return null;

          const stats = getPhaseStats(phase.id);
          const isBad = cyclePhaseIds.has(phase.id);

          return (
            <div
              key={phase.id}
              onClick={() => {
                if (!panRef.current?.moved) {
                  onOpenPhase(phase.id);
                }
              }}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${PW}px`,
                height: `${PHH}px`,
              }}
              className={`absolute cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-blue-400 ${
                isBad
                  ? 'border-rose-400 ring-2 ring-rose-200'
                  : 'border-slate-200/90'
              }`}
            >
              {/* Header: Phase badge & Delete */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase">
                  PHASE {idx + 1}
                </span>

                {phases.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePhase(phase.id);
                    }}
                    title="Delete phase"
                    className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Phase Name */}
              <div
                className="mt-1 font-bold text-slate-900 leading-snug line-clamp-2"
                title={phase.name}
              >
                {phase.name}
              </div>

              {/* Subtitle / Counts */}
              <div className="mt-2 flex gap-3 text-xs text-slate-500 font-medium">
                <span>{stats.tracks} tracks</span>
                <span>•</span>
                <span>{stats.tasks} tasks</span>
              </div>

              {/* Bottom footer status */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs">
                <span
                  className={
                    isBad ? 'font-semibold text-rose-600' : 'text-slate-400'
                  }
                >
                  {isBad ? 'In cycle' : 'Click to design'}
                </span>
                <span className="inline-flex items-center gap-0.5 font-bold text-blue-600">
                  <span>Open</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

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
      <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
        Kéo để Pan · Cuộn để Zoom · Bấm vào Phase để thiết kế chi tiết
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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <span className="w-12 text-center text-xs font-bold text-slate-700">
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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleFit}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          title="Fit View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
};
