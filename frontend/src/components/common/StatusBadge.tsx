import type { FC } from 'react'
import type { ProjectStatus } from '../../types/workspace.types'

const STATUS_STYLES: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  INACTIVE: 'bg-orange-50 text-orange-700 border-orange-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
}

interface StatusBadgeProps {
  status: ProjectStatus
  className?: string
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold border rounded-full px-2 py-0.5 select-none ${style} ${className}`}
    >
      {status}
    </span>
  )
}
