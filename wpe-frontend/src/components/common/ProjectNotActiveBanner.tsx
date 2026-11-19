import { PauseCircle } from 'lucide-react'
import { memberWorkLockedMessage } from '../../domain/projectWork'

/** Băng báo cho Cộng tác viên/Viewer: dự án chưa chạy (không ACTIVE) nên chỉ được xem task. */
export function ProjectNotActiveBanner({ projectStatus, className = '' }: { projectStatus: string | null | undefined; className?: string }) {
  return (
    <div
      role="status"
      data-testid="project-not-active-banner"
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      <PauseCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
      <span>{memberWorkLockedMessage(projectStatus)} You can still view tasks.</span>
    </div>
  )
}
