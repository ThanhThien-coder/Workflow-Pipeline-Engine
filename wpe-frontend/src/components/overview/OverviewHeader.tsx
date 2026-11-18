import type { AiDiagnosticReport, GuestAccessState } from '../../types/overview.types'
import type { OverviewData } from '../../types/overview.types'
import { relativeEn } from '../../utils/relativeTime'
import { AiDiagnosisPopover } from '../popovers/AiDiagnosisPopover'
import { GuestAccessPopover } from '../popovers/GuestAccessPopover'

interface OverviewHeaderProps {
  project: OverviewData['project']
  aiReport: AiDiagnosticReport
  guestAccess: GuestAccessState
  onRevoke: () => Promise<void>
  onGenerate: () => Promise<void>
  notify: (message: string) => void
  aiScanning?: boolean
  aiScanError?: string | null
  onRescan?: () => void
}

export function OverviewHeader({
  project,
  aiReport,
  guestAccess,
  onRevoke,
  onGenerate,
  notify,
  aiScanning,
  aiScanError,
  onRescan,
}: OverviewHeaderProps) {
  const hasAiInsights = aiReport.hasAnalysis !== false && aiReport.insights.length > 0
  return (
    <header className="sticky top-0 z-[45] border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 md:flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
            {project.role === 'OWNER' && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                Owner
              </span>
            )}
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {project.phaseLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Last updated {relativeEn(project.lastUpdatedAt)} · Engine running
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:shrink-0 md:flex-nowrap">
          {!hasAiInsights && (
            <span
              data-testid="ai-diagnosis-empty"
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
            >
              {aiReport.emptyMessage || 'No diagnosis yet'}
            </span>
          )}
          <AiDiagnosisPopover
            report={aiReport}
            scanning={aiScanning}
            scanError={aiScanError}
            onRescan={onRescan}
          />
          <GuestAccessPopover
            state={guestAccess}
            onRevoke={onRevoke}
            onGenerate={onGenerate}
            notify={notify}
            canManage={project.role === 'OWNER'}
          />
        </div>
      </div>
    </header>
  )
}
