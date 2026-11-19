import { type FC } from 'react'
import { motion } from 'framer-motion'
import { FolderGit2 } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { pluralize } from '../../utils/pluralize'

export interface WorkflowArtifactsIslandProps {
  count?: number
  onClick?: () => void
  className?: string
}

export const WorkflowArtifactsIsland: FC<WorkflowArtifactsIslandProps> = ({
  count: propCount,
  onClick,
  className = '',
}) => {
  const storeCount = useWorkflowStore((state) => state.artifacts.items.length)
  const openDrawer = useWorkflowStore((state) => state.artifacts.openDrawer)

  const count = propCount !== undefined ? propCount : storeCount

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    } else {
      openDrawer()
    }
  }

  return (
    <motion.button
      type="button"
      data-pan-zoom-ignore="true"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className={`flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none transition-colors hover:border-slate-300 hover:bg-slate-50 ${className}`}
      aria-label={`Open deliverables artifacts (${pluralize(count, 'item')})`}
    >
      <FolderGit2 className="text-mp-purple-700 w-3.5 h-3.5 shrink-0" />
      <span>Artifacts</span>
      <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-mp-purple-50 text-mp-purple-700 border border-mp-purple-200/60">
        {count}
      </span>
    </motion.button>
  )
}

export default WorkflowArtifactsIsland
