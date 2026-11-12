import type { FC } from 'react'
import type { ProjectRole } from '../../types/settings.types'

const ROLE_STYLES: Record<ProjectRole, string> = {
  OWNER: 'bg-violet-50 text-violet-700 border-violet-200',
  MANAGER: 'bg-amber-50 text-amber-700 border-amber-200',
  COLLABORATOR: 'bg-sky-50 text-sky-700 border-sky-200',
  VIEWER: 'bg-slate-100 text-slate-600 border-slate-200',
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'OWNER',
  MANAGER: 'Quản lý',
  COLLABORATOR: 'COLLABORATOR',
  VIEWER: 'VIEWER',
}

interface RoleBadgeProps {
  role: ProjectRole
  className?: string
  displayFormat?: 'uppercase' | 'titlecase'
}

export const RoleBadge: FC<RoleBadgeProps> = ({
  role,
  className = '',
  displayFormat = 'uppercase',
}) => {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.VIEWER
  const label =
    displayFormat === 'uppercase'
      ? ROLE_LABELS[role] ?? 'VIEWER'
      : role === 'OWNER'
        ? 'Owner'
        : role === 'MANAGER'
          ? 'Quản lý'
          : role === 'COLLABORATOR'
            ? 'Collaborator'
            : 'Viewer'

  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold border rounded-full px-2 py-0.5 select-none ${style} ${className}`}
    >
      {label}
    </span>
  )
}
