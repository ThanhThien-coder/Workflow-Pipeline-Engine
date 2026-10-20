import { type FC } from 'react'
import { motion } from 'framer-motion'
import { FolderGit2 } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'

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
      className={`rounded-full px-4 py-2 bg-white/95 backdrop-blur-md border border-mp-n-200/80 shadow-mp-float flex items-center gap-2.5 cursor-pointer hover:shadow-lg hover:border-mp-purple-200 transition-all select-none ${className}`}
      aria-label={`Open deliverables artifacts (${count} items)`}
    >
      <FolderGit2 className="text-mp-purple-700 w-4 h-4 shrink-0" />
      <span className="font-medium text-sm text-mp-ink">Artifacts</span>
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-mp-purple-50 text-mp-purple-700 border border-mp-purple-200/60">
        {count}
      </span>
    </motion.button>
  )
}

export default WorkflowArtifactsIsland
