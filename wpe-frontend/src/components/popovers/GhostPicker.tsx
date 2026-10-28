import { useState, useEffect } from 'react'
import type { GraphNodeMap, BranchGraphNode } from '../../types/workflow.types'

export function GhostPicker({
  trees,
  currentPhase,
  anchorId,
  onConfirm,
  onClose,
}: {
  trees: Record<string, GraphNodeMap>
  currentPhase: string
  anchorId?: string
  onConfirm: (value: {
    refPhase: string
    refId: string
    dir: 'up' | 'down'
    anchorId?: string
    targetTaskId?: string
  }) => void
  onClose: () => void
}) {
  const phases = Object.keys(trees).filter((id) => id !== currentPhase)
  const [phase, setPhase] = useState(phases[0] ?? '')

  const currentTasks = Object.values(trees[currentPhase] ?? {}).filter(
    (n): n is BranchGraphNode => n.kind === 'branch' && !n.isTrack
  )
  const [targetTask, setTargetTask] = useState(anchorId || currentTasks[0]?.id || '')

  const tasks = phase
    ? Object.values(trees[phase] ?? {}).filter(
        (node): node is BranchGraphNode => node.kind === 'branch' && !node.isTrack
      )
    : []
  const [task, setTask] = useState(tasks[0]?.id ?? '')

  useEffect(() => {
    if (tasks.length > 0) {
      setTask(tasks[0].id)
    } else {
      setTask('')
    }
  }, [phase, tasks.length])

  return (
    <div className="space-y-3 p-1 select-none text-slate-800">
      <div>
        <h4 className="text-sm font-bold text-slate-900">
          Attach Ghost Prerequisite
        </h4>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Link an external milestone from another phase that blocks a task in this phase.
        </p>
      </div>

      <label className="block text-xs font-semibold text-slate-700">
        Source Phase
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 shadow-2xs"
        >
          {phases.map((id) => (
            <option key={id} value={id} className="bg-white text-slate-900">
              {id.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Source Milestone / Task
        <select
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={tasks.length === 0}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 disabled:opacity-50 shadow-2xs"
        >
          {tasks.map((node) => (
            <option key={node.id} value={node.id} className="bg-white text-slate-900">
              {node.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Target Task (Blocked by Prerequisite)
        <select
          value={targetTask}
          onChange={(e) => setTargetTask(e.target.value)}
          disabled={currentTasks.length === 0}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 disabled:opacity-50 shadow-2xs"
        >
          {currentTasks.map((node) => (
            <option key={node.id} value={node.id} className="bg-white text-slate-900">
              {node.title}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-end gap-2 pt-2.5 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!phase || !task || !targetTask}
          onClick={() =>
            onConfirm({
              refPhase: phase,
              refId: task,
              dir: 'up',
              anchorId: targetTask,
              targetTaskId: targetTask,
            })
          }
          className="rounded-xl bg-gradient-to-r from-indigo-900 to-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer"
        >
          Attach Ghost Node
        </button>
      </div>
    </div>
  )
}
