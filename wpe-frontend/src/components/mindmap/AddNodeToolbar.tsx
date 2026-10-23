import React from 'react'
import { PlusCircle, GitBranch } from 'lucide-react'

export interface AddNodeToolbarProps {
  onAddTrack: () => void
  onAddGhost: (pos?: { x: number; y: number; anchorId?: string }) => void
}

export function AddNodeToolbar({ onAddTrack, onAddGhost }: AddNodeToolbarProps) {
  return (
    <div
      className="absolute bottom-6 left-6 z-30 flex items-center gap-3 shrink-0 whitespace-nowrap select-none"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {/* Button 1: + Add Root Task */}
      <button
        type="button"
        onClick={onAddTrack}
        title="Add Root Task"
        className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-lg transition-all hover:border-blue-400 hover:text-blue-600 hover:shadow-mp-glow cursor-pointer"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-xs">
          <PlusCircle size={13} className="text-white" />
        </span>
        <span>+ Add Root Task</span>
      </button>

      {/* Button 2: Add Ghost Node */}
      <button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onAddGhost({ x: rect.left, y: rect.top - 8 })
        }}
        title="Add Ghost Node"
        className="flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-lg transition-all hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-400 hover:shadow-mp-glow cursor-pointer"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 shadow-xs">
          <GitBranch size={13} />
        </span>
        <span>Add Ghost Node</span>
      </button>
    </div>
  )
}
