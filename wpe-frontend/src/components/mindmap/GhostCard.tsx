import React from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Trash2 } from 'lucide-react'
import type { GhostGraphNode } from '../../types/workflow.types'
import { useWorkflowStore } from '../../store/useWorkflowStore'

export interface GhostCardProps {
  node: GhostGraphNode
  onDelete: () => void
  onHover?: (id: string | null) => void
  isHovered?: boolean
  onSpawnDown?: (event: React.MouseEvent<HTMLButtonElement>, sourceId: string) => void
}

export function GhostCard({
  node,
  onDelete,
  onHover,
  isHovered,
}: GhostCardProps) {
  const store = useWorkflowStore.getState()
  const sourceTask = store?.trees?.[node.refPhase]?.[node.refId]
  const sourcePhase = store?.macroPhases?.find((p) => p.id === node.refPhase)

  const isCompleted =
    node.status === 'DONE' ||
    (sourceTask && 'status' in sourceTask && sourceTask.status === 'DONE')

  const displayTitle =
    node.sourceTaskTitle ||
    (sourceTask && 'title' in sourceTask ? sourceTask.title : '') ||
    node.title ||
    node.refId

  const phaseLabel =
    node.sourcePhaseTitle ||
    sourcePhase?.name ||
    node.refPhase

  const sourcePhaseId = (node.refPhase || '').toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      data-node-id={node.id}
      data-parents={node.parentIds.join(',')}
      data-primary={node.parentIds[0] || ''}
      data-status={node.kind}
      data-ghost="1"
      style={{ width: '100%', height: '100%' }}
      className={`group relative select-none rounded-2xl border-2 border-dashed border-indigo-300/80 dark:border-indigo-500/60 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/30 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-indigo-950/40 shadow-xs backdrop-blur-xs p-3.5 min-w-[210px] flex flex-col justify-between transition-all duration-150 box-border h-full cursor-pointer hover:border-indigo-400/90 ${
        isHovered ? 'ring-2 ring-indigo-400 shadow-md' : ''
      }`}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Top Row: Ghost Pill + Subtle Delete Button */}
      <div className="flex items-center justify-between">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase bg-indigo-100/80 text-indigo-700 dark:bg-mp-purple-950/60 dark:text-mp-purple-300 border border-indigo-200/60 dark:border-indigo-800/60 truncate max-w-[170px]">
          [GHOST - {sourcePhaseId}]
        </span>

        {/* Refined Delete Button */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onDelete()
          }}
          title="Remove ghost prerequisite"
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-mp-n-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle: Source Task Title & Phase Origin */}
      <div>
        <h4 className="text-sm font-semibold text-mp-ink dark:text-slate-100 line-clamp-1 leading-tight">
          {displayTitle}
        </h4>
        <p className="text-xs text-mp-n-500 dark:text-slate-400 font-medium mt-0.5">
          From {phaseLabel}
        </p>
      </div>

      {/* Bottom: Inline Status Pill */}
      <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-900/40 flex items-center">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/70">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Completed ✓</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/70">
            <Clock className="w-3.5 h-3.5" />
            <span>Waiting Prerequisite ⏳</span>
          </span>
        )}
      </div>
    </motion.div>
  )
}
