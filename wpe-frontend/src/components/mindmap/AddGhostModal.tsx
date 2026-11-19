import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, X, Link2, AlertCircle } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { phaseDisplayName } from '../../utils/phaseName'
import { useWorkflowService } from '../../services/workflow/WorkflowContext'
import type { BranchGraphNode } from '../../types/workflow.types'
import { normalizeText } from '../../utils/searchProject'

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
  const macroPhases = useWorkflowStore((state) => state.macroPhases)
  const trees = useWorkflowStore((state) => state.trees)
  const workflowService = useWorkflowService()

  // 1. Available Source Phases (excluding current phase)
  const availablePhases = macroPhases.filter((p) => p.id !== currentPhaseId)
  const [sourcePhaseId, setSourcePhaseId] = useState<string>('')
  const [sourceTaskId, setSourceTaskId] = useState<string>('')
  const [targetTaskId, setTargetTaskId] = useState<string>('')
  const [sourceQuery, setSourceQuery] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize sourcePhaseId
  useEffect(() => {
    if (availablePhases.length > 0 && !sourcePhaseId) {
      setSourcePhaseId(availablePhases[0].id)
    }
  }, [availablePhases, sourcePhaseId])

  // Current Phase Tasks (Target Tasks)
  const currentTree = trees[currentPhaseId] || {}
  const targetTasks = Object.values(currentTree).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  )

  // Source Phase Tasks
  const sourceTree = trees[sourcePhaseId] || {}
  const allSourceTasks = Object.values(sourceTree).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  )
  // Ô tìm task nguồn: lọc theo mã, tên (không phân biệt dấu)
  const normalizedSourceQuery = normalizeText(sourceQuery)
  const sourceTasks = normalizedSourceQuery
    ? allSourceTasks.filter(
        (t) =>
          normalizeText(t.code).includes(normalizedSourceQuery) ||
          normalizeText(t.title).includes(normalizedSourceQuery),
      )
    : allSourceTasks

  // Update sourceTaskId when sourcePhaseId changes
  useEffect(() => {
    if (sourceTasks.length > 0) {
      setSourceTaskId(sourceTasks[0].id)
    } else {
      setSourceTaskId('')
    }
  }, [sourcePhaseId, sourceTasks.length, normalizedSourceQuery])

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
            className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 z-10 text-slate-800 select-none"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <GitBranch size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Attach Ghost Prerequisite
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Link an external milestone from another phase that blocks a task in this phase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error banner if any */}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
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
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Source Phase
                </label>
                <select
                  id="sourcePhaseId"
                  value={sourcePhaseId}
                  onChange={(e) => setSourcePhaseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-2xs"
                >
                  {availablePhases.map((phase) => (
                    <option
                      key={phase.id}
                      value={phase.id}
                      className="bg-white text-slate-900 py-1.5"
                    >
                      {phaseDisplayName(phase) || 'Phase'}
                    </option>
                  ))}
                  {availablePhases.length === 0 && (
                    <option
                      value=""
                      className="bg-white text-slate-500"
                    >
                      No other phases available
                    </option>
                  )}
                </select>
              </div>

              {/* Field 2: Source Milestone / Task */}
              <div>
                <label
                  htmlFor="sourceTaskId"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Source Milestone / Task
                </label>
                <input
                  type="text"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="Search by code or title..."
                  aria-label="Search source tasks"
                  className="mb-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <select
                  id="sourceTaskId"
                  value={sourceTaskId}
                  onChange={(e) => setSourceTaskId(e.target.value)}
                  disabled={sourceTasks.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                >
                  {sourceTasks.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      className="bg-white text-slate-900 py-1.5"
                    >
                      {t.title} [{t.code || t.id}] · {t.status}
                    </option>
                  ))}
                  {sourceTasks.length === 0 && (
                    <option
                      value=""
                      className="bg-white text-slate-500"
                    >
                      {allSourceTasks.length > 0 ? 'No tasks match your search' : 'No tasks found in selected phase'}
                    </option>
                  )}
                </select>
              </div>

              {/* Field 3: Target Task in Current Phase */}
              <div>
                <label
                  htmlFor="targetTaskId"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Target Task (Blocked by Prerequisite)
                </label>
                <select
                  id="targetTaskId"
                  value={targetTaskId}
                  onChange={(e) => setTargetTaskId(e.target.value)}
                  disabled={targetTasks.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                >
                  {targetTasks.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      className="bg-white text-slate-900 py-1.5"
                    >
                      {t.title} [{t.code || t.id}] · {t.status}
                    </option>
                  ))}
                  {targetTasks.length === 0 && (
                    <option
                      value=""
                      className="bg-white text-slate-500"
                    >
                      No tasks available in current phase
                    </option>
                  )}
                </select>
              </div>

              {/* Prerequisite Preview Notice */}
              <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-slate-600 flex items-start gap-2">
                <Link2 size={15} className="text-indigo-600 mt-0.5 shrink-0" />
                <span>
                  The ghost node will be anchored strictly to the <strong>right</strong> of the target task.
                  If the source task is not completed, the target task remains locked.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
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
