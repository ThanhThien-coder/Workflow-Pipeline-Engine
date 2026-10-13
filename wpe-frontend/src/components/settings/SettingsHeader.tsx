import { ShieldAlert } from 'lucide-react'
import type { ProjectRole } from '../../types/settings.types'

interface SettingsHeaderProps {
  myRole: ProjectRole
}

export function SettingsHeader({ myRole }: SettingsHeaderProps) {
  const isOwner = myRole === 'OWNER'

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Project Settings</h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage pipeline configuration, workspace members, and governance policies.
          </p>
        </div>
      </header>

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 shadow-sm animate-fade-in">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            You are viewing settings in read-only mode. Only the Project Owner can modify governance configurations.
          </span>
        </div>
      )}
    </div>
  )
}
