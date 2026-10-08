import React, { useState, useEffect, useMemo } from 'react';
import type {
  PhaseDto,
  PhaseEdgeDto,
  TemplateNodeDto,
} from '../../../../types/template.types';
import { computeTopologicalPhaseRanks } from '../../../../lib/graph/phaseLayout';
import { TreeGraphView } from './TreeGraphView';
import { PhaseKanbanView } from './PhaseKanbanView';
import { TaskInspector } from './TaskInspector';
import { X, Network, Kanban } from 'lucide-react';

interface PhaseDetailDrawerProps {
  phase: PhaseDto | null;
  allPhases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  selectedNodeId: string | null;
  cycleNodeIds: Set<string>;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePhaseName: (name: string) => void;
  onTogglePhaseDep: (sourcePhaseId: string) => void;
  onSelectNode: (id: string | null) => void;
  onAddChild: (parentId: string) => void;
  onUpdateNode: (
    id: string,
    patch: Partial<Pick<TemplateNodeDto, 'title' | 'description' | 'joinPolicy'>>
  ) => void;
  onDeleteNode: (id: string) => void;
}

export const PhaseDetailDrawer: React.FC<PhaseDetailDrawerProps> = ({
  phase,
  allPhases,
  phaseEdges,
  nodes,
  selectedNodeId,
  cycleNodeIds,
  isOpen,
  onClose,
  onUpdatePhaseName,
  onTogglePhaseDep,
  onSelectNode,
  onAddChild,
  onUpdateNode,
  onDeleteNode,
}) => {
  const [viewMode, setViewMode] = useState<'graph' | 'kanban'>('graph');

  // Compute 1-based Topological Sort order for Phase sequence badge
  const topoRanks = useMemo(() => {
    return computeTopologicalPhaseRanks(allPhases, phaseEdges);
  }, [allPhases, phaseEdges]);

  const currentRank = phase ? topoRanks.get(phase.id) || 1 : 1;

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !phase) return null;

  const phaseNodes = nodes.filter((n) => n.phaseId === phase.id);
  const otherPhases = allPhases.filter((p) => p.id !== phase.id);

  // Compute stats
  let tracks = 0;
  let tasks = 0;
  for (const n of phaseNodes) {
    if (n.level === 1) tracks++;
    if (n.level >= 2) tasks++;
  }

  const selectedNode = phaseNodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 right-0 bottom-0 z-[60] flex w-[60vw] min-w-[720px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl animate-fade">
        {/* Drawer Header */}
        <div className="border-b border-slate-200 p-5 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-blue-700 uppercase border border-blue-200">
                  PHASE {currentRank}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  PHASE DETAIL
                </span>
              </div>
              <input
                type="text"
                value={phase.name}
                onChange={(e) => onUpdatePhaseName(e.target.value)}
                placeholder="Nhập tên giai đoạn (vd: Phân tích yêu cầu)..."
                className="mt-1.5 w-full text-xl font-extrabold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 outline-none transition"
              />
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {tasks} tasks · {tracks} tracks
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === 'graph'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Network className="h-3.5 w-3.5" />
                <span>Graph View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === 'kanban'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban View</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Close drawer (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Runs after Phase dependencies chips */}
          {otherPhases.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">Runs after:</span>
              {otherPhases.map((other) => {
                const isDependent = phaseEdges.some(
                  (e) => e.parentPhaseId === other.id && e.childPhaseId === phase.id
                );

                return (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => onTogglePhaseDep(other.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold border transition ${
                      isDependent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {other.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-auto admin-grid-bg p-4">
          {viewMode === 'graph' ? (
            <TreeGraphView
              nodes={phaseNodes}
              selectedNodeId={selectedNodeId}
              cycleNodeIds={cycleNodeIds}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
            />
          ) : (
            <PhaseKanbanView
              nodes={phaseNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
            />
          )}
        </div>

        {/* Drawer Footer: Task Inspector Dock */}
        <div className="border-t border-slate-200 bg-white p-4 shadow-lg">
          <TaskInspector
            selectedNode={selectedNode}
            onUpdateNode={onUpdateNode}
            onAddChild={onAddChild}
            onDeleteNode={onDeleteNode}
          />
        </div>
      </aside>
    </>
  );
};
