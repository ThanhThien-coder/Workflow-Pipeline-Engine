import React from 'react'
import { MicroGraphTree } from '../mindmap/MicroGraphTree'
import { WorkflowServiceProvider } from '../../services/workflow/WorkflowContext'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { GraphNodeMap } from '../../types/workflow.types'

export interface PhaseDetailGraphViewProps {
  phaseId: string
  nodes?: GraphNodeMap
  selectedNodeId?: string | null
  onSelectNode?: (id: string) => void
  onDeleteNode?: (id: string) => void
  onUpdateNodes?: (update: (nodes: GraphNodeMap) => GraphNodeMap) => void
}

export function PhaseDetailGraphView({
  phaseId,
  nodes,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onUpdateNodes,
}: PhaseDetailGraphViewProps) {
  const store = useWorkflowStore()
  const macroPhase = store.macroPhases.find((p) => p.id === phaseId)

  return (
    <WorkflowServiceProvider>
      <div className="flex flex-col w-full h-full min-h-0 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Phase Header Meta */}
        {macroPhase && (
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Phase Detail Tree Graph
              </span>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {macroPhase.name} — {macroPhase.sub}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Progress: <strong className="text-slate-700 dark:text-slate-200">{macroPhase.pct}%</strong>
              </span>
              <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${macroPhase.pct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tree Graph Canvas */}
        <div className="flex-1 w-full h-full relative min-h-0 overflow-hidden">
          <MicroGraphTree
            phaseId={phaseId}
            nodes={nodes}
            selectedId={selectedNodeId}
            onSelect={onSelectNode}
            onDeleteNode={onDeleteNode}
            onUpdateNodes={onUpdateNodes}
          />
        </div>
      </div>
    </WorkflowServiceProvider>
  )
}
