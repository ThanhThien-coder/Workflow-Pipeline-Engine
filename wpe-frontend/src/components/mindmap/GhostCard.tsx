import React from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Trash2, GitBranch } from 'lucide-react'
import type { GhostGraphNode } from '../../types/workflow.types'
import { useWorkflowStore } from '../../store/useWorkflowStore'

export interface GhostCardProps {
  node: GhostGraphNode
  onDelete: () => void
  onHover?: (id: string | null) => void
  isHovered?: boolean
  onSpawnDown?: (event: React.MouseEvent<HTMLButtonElement>, sourceId: string) => void
  /** B5: người không phải owner thì không có nút gỡ ghost. */
  readOnly?: boolean
}

export function GhostCard({
  node,
  onDelete,
  onHover,
  isHovered,
  readOnly = false,
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
      className={`group relative select-none rounded-2xl border-2 border-dashed border-indigo-400 bg-white shadow-sm hover:shadow-md min-w-[210px] flex flex-col justify-between transition-all duration-150 box-border h-full cursor-pointer overflow-hidden ${
        isHovered ? 'ring-2 ring-indigo-500 shadow-indigo-100 border-indigo-600' : ''
      }`}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Top Banner Header: Full-width colored gradient across top */}
      <div className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-3 py-1.5 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          <GitBranch size={12} className="text-white shrink-0" />
          <span
            className="text-[10px] font-mono font-bold tracking-wider uppercase truncate"
            title={`[GHOST - ${sourcePhaseId}]`}
          >
            [GHOST - {sourcePhaseId}]
          </span>
        </div>

        {/* Delete Prerequisite Button */}
        {!readOnly && <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onDelete()
          }}
          title="Remove ghost prerequisite"
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>}
      </div>

      {/* Card Body */}
      <div className="p-2.5 px-3 flex flex-col justify-between flex-1 min-h-0 bg-white">
        {/* Source Task Title & Phase Origin */}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-mp-ink text-slate-900 line-clamp-1 leading-snug">
            {displayTitle}
          </h4>
          <div className="text-[11px] font-medium text-indigo-600 mt-1 flex items-center gap-1 min-w-0">
            <span className="text-slate-400 shrink-0">↳ Prerequisite from:</span>
            <span className="font-bold underline decoration-indigo-300 truncate" title={phaseLabel}>
              {phaseLabel}
            </span>
          </div>
        </div>

        {/* Bottom: Inline Status Pill */}
        <div className="pt-1.5 border-t border-indigo-100 flex items-center">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Completed ✓</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Waiting Prerequisite ⏳</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
