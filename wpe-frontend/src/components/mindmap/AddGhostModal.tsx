import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, X, Link2, AlertCircle } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useWorkflowService } from '../../services/workflow/WorkflowContext'
import type { BranchGraphNode } from '../../types/workflow.types'

export interface AddGhostModalProps {
  isOpen: boolean
  onClose: () => void
  currentPhaseId: string
  anchorTaskId?: string
  onAttach?: (payload: {
    sourcePhaseId: string
    sourceTaskId: string
    targetTaskId: string
  }) => Promise<void> | void
}

export function AddGhostModal({
  isOpen,
  onClose,
  currentPhaseId,
  anchorTaskId,
  onAttach,
}: AddGhostModalProps) {
  const store = useWorkflowStore()
  const workflowService = useWorkflowService()

  // 1. Available Source Phases (excluding current phase)
  const availablePhases = store.macroPhases.filter((p) => p.id !== currentPhaseId)
  const [sourcePhaseId, setSourcePhaseId] = useState<string>('')
  const [sourceTaskId, setSourceTaskId] = useState<string>('')
  const [targetTaskId, setTargetTaskId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize sourcePhaseId
  useEffect(() => {
    if (availablePhases.length > 0 && !sourcePhaseId) {
      setSourcePhaseId(availablePhases[0].id)
    }
  }, [availablePhases, sourcePhaseId])

  // Current Phase Tasks (Target Tasks)
  const currentTree = store.trees[currentPhaseId] || {}
  const targetTasks = Object.values(currentTree).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  )

  // Source Phase Tasks
  const sourceTree = store.trees[sourcePhaseId] || {}
  const sourceTasks = Object.values(sourceTree).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  )

  // Update sourceTaskId when sourcePhaseId changes
  useEffect(() => {
    if (sourceTasks.length > 0) {
      setSourceTaskId(sourceTasks[0].id)
    } else {
      setSourceTaskId('')
    }
  }, [sourcePhaseId, sourceTasks.length])

  // Initialize or set targetTaskId
  useEffect(() => {
    if (anchorTaskId && targetTasks.some((t) => t.id === anchorTaskId)) {
      setTargetTaskId(anchorTaskId)
    } else if (targetTasks.length > 0 && !targetTaskId) {
      setTargetTaskId(targetTasks[0].id)
    }
  }, [anchorTaskId, targetTasks, targetTaskId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourcePhaseId || !sourceTaskId || !targetTaskId) {
      setError('Please select a source phase, milestone, and target task.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      if (onAttach) {
        await onAttach({ sourcePhaseId, sourceTaskId, targetTaskId })
      } else {
        await workflowService.attachGhostNode(currentPhaseId, {
          sourcePhaseId,
          sourceTaskId,
          targetTaskId,
        })
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach ghost prerequisite')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Dialog Window with Spring physics */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 z-10"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <GitBranch size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Attach Ghost Prerequisite
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Link an external milestone from another phase that blocks a task in this phase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error banner if any */}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 3-Step Cascading Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Field 1: Source Phase */}
              <div>
                <label
                  htmlFor="sourcePhaseId"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Source Phase
                </label>
                <select
                  id="sourcePhaseId"
                  value={sourcePhaseId}
                  onChange={(e) => setSourcePhaseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  {availablePhases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name} ({phase.id.toUpperCase()})
                    </option>
                  ))}
                  {availablePhases.length === 0 && (
                    <option value="">No other phases available</option>
                  )}
                </select>
              </div>

              {/* Field 2: Source Milestone / Task */}
              <div>
                <label
                  htmlFor="sourceTaskId"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Source Milestone / Task
                </label>
                <select
                  id="sourceTaskId"
                  value={sourceTaskId}
                  onChange={(e) => setSourceTaskId(e.target.value)}
                  disabled={sourceTasks.length === 0}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {sourceTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} [{t.status}]
                    </option>
                  ))}
                  {sourceTasks.length === 0 && (
                    <option value="">No tasks found in selected phase</option>
                  )}
                </select>
              </div>

              {/* Field 3: Target Task in Current Phase */}
              <div>
                <label
                  htmlFor="targetTaskId"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Target Task (Blocked by Prerequisite)
                </label>
                <select
                  id="targetTaskId"
                  value={targetTaskId}
                  onChange={(e) => setTargetTaskId(e.target.value)}
                  disabled={targetTasks.length === 0}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {targetTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} [{t.code}]
                    </option>
                  ))}
                  {targetTasks.length === 0 && (
                    <option value="">No tasks available in current phase</option>
                  )}
                </select>
              </div>

              {/* Prerequisite Preview Notice */}
              <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Link2 size={15} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <span>
                  The ghost node will be anchored strictly to the <strong>right</strong> of the target task.
                  If the source task is not completed, the target task remains locked.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !sourceTaskId || !targetTaskId}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-900 via-indigo-700 to-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <GitBranch size={14} />
                  <span>{isSubmitting ? 'Attaching...' : 'Attach Ghost Node'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
