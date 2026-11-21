import { useCallback, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import type { AiDiagnosticReport, AiDiagnosisMetrics } from '../../types/overview.types'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'
import { useDismiss } from '../../hooks/useDismiss'
import { SparkleIcon } from '../common/SparkleIcon'
import { relativeEn } from '../../utils/relativeTime'

export interface AiDiagnosisPopoverProps {
  report: AiDiagnosticReport
  scanning?: boolean
  scanError?: string | null
  onRescan?: () => void
  /** false: người xem không được chạy AI (chỉ owner/manager); nút chạy bị tắt kèm câu giải thích. */
  canRun?: boolean
}

export const AI_RUN_OWNER_MANAGER_ONLY = 'Only the project owner or a manager can run an AI scan.'

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function renderMetrics(metrics: AiDiagnosisMetrics) {
  const { status, driftScore, completedLast7Days, overdueDays, remainingTasks } = metrics

  let statusNode: React.ReactNode = null
  let chipClass = ''

  if (status === 'INSUFFICIENT_DATA') {
    statusNode = 'Not enough data'
    chipClass = 'bg-slate-100 text-slate-700 border-slate-200'
  } else if (status === 'OVERDUE') {
    const parts: string[] = []
    if (typeof overdueDays === 'number' && Number.isFinite(overdueDays)) {
      parts.push(`Overdue by ${pluralize(overdueDays, 'day', 'days')}`)
    }
    if (typeof remainingTasks === 'number' && Number.isFinite(remainingTasks)) {
      parts.push(`${pluralize(remainingTasks, 'task', 'tasks')} left`)
    }
    statusNode = parts.length > 0 ? parts.join(' · ') : 'Overdue'
    chipClass = 'bg-red-50 text-red-700 border-red-200'
  } else if (status === 'STABLE_GREEN' || status === 'YELLOW_WARNING' || status === 'RED_ALERT') {
    const baseLabel =
      status === 'STABLE_GREEN' ? 'On track' : status === 'YELLOW_WARNING' ? 'At risk' : 'Off track'
    chipClass =
      status === 'STABLE_GREEN'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : status === 'YELLOW_WARNING'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-red-50 text-red-700 border-red-200'

    const hasDrift = typeof driftScore === 'number' && Number.isFinite(driftScore)
    statusNode = (
      <>
        <span>{baseLabel}</span>
        {hasDrift && (
          <>
            <span className="opacity-60"> · </span>
            <span>Drift {driftScore}%</span>
          </>
        )}
      </>
    )
  }

  const hasCompleted = typeof completedLast7Days === 'number' && Number.isFinite(completedLast7Days)
  const completedLabel = hasCompleted
    ? `${pluralize(completedLast7Days, 'task', 'tasks')} done in the last 7 days`
    : null

  return (
    <div data-testid="ai-metrics" className="mx-6 mt-4 flex flex-wrap items-center gap-2 text-xs">
      {statusNode && (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium ${chipClass}`}>
          {statusNode}
        </span>
      )}
      {completedLabel && (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-medium text-slate-600">
          {completedLabel}
        </span>
      )}
    </div>
  )
}

export function AiDiagnosisPopover({
  report,
  scanning = false,
  scanError = null,
  onRescan,
  canRun = true,
}: AiDiagnosisPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition(isOpen, buttonRef)
  const close = useCallback(() => setIsOpen(false), [])
  const noAnalysis = report.hasAnalysis === false
  useDismiss(isOpen, close, [buttonRef, popoverRef])

  return (
    <div className="relative z-[45] shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-indigo-700 transition ${
          isOpen
            ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
            : 'border-indigo-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
        }`}
      >
        <SparkleIcon /> AI Diagnosis
      </button>

      {isOpen && (
        <>
          <div className="fade-in fixed inset-0 z-40 bg-slate-900/10" />
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="AI Pipeline Diagnostic Insights"
            data-lenis-prevent
            className="pop-in fixed inset-x-0 z-50 mx-auto max-h-[calc(100vh-120px)] w-[calc(100%-4rem)] max-w-5xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-md"
            style={{ top: position.top, transformOrigin: `${position.origin}px top` }}
          >
            <div
              className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white"
              style={{ left: position.caret }}
            />
            <div className="relative flex items-start justify-between gap-4 rounded-t-2xl border-b border-slate-100 bg-white px-6 pb-4 pt-5">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 p-2">
                  <SparkleIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">AI Pipeline Diagnostic Insights</h3>
                  <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    {noAnalysis ? (
                      'No diagnosis yet'
                    ) : (
                      <>
                        {report.engine === 'Gemini' ? 'Model: Gemini Engine' : `Source: ${report.engine}`} · Updated{' '}
                        {relativeEn(report.generatedAt)}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {report.metrics && renderMetrics(report.metrics)}

            {report.warning && (
              <div
                role="alert"
                className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <span>{report.warning}</span>
              </div>
            )}

            {scanError && (
              <div
                role="status"
                data-testid="ai-scan-error"
                className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
                <span>{scanError}</span>
              </div>
            )}

            {noAnalysis && (
              <p
                data-testid="ai-popover-empty"
                className="mx-6 my-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500"
              >
                Run a scan to get insights on bottlenecks, task traps and next steps.
              </p>
            )}

            {report.rootCauseNotes && (
              <div
                data-testid="ai-root-cause"
                className="mx-6 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Root cause</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">{report.rootCauseNotes}</p>
              </div>
            )}

            <div className="my-5 grid grid-cols-1 gap-4 px-6 md:grid-cols-3">
              {report.insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`flex flex-col rounded-xl border p-4 transition-opacity ${insight.boxClass} ${
                    scanning ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg">{insight.icon}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${insight.tagClass}`}>
                      {insight.tag}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {insight.kicker}
                  </div>
                  <h4 className="mt-1 text-sm font-semibold leading-snug text-slate-900">{insight.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{insight.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-6 py-3.5">
              <p className="max-w-xl text-[11px] text-slate-400">
                {scanning
                  ? 'Analysis in progress, this can take up to ~3 minutes on a slow network.'
                  : !canRun
                    ? AI_RUN_OWNER_MANAGER_ONLY
                    : 'Automated diagnosis evaluated against DAG topology and state machine transitions across all project nodes.'}
              </p>
              <button
                type="button"
                onClick={onRescan}
                disabled={!onRescan || scanning || !canRun}
                title={!canRun ? AI_RUN_OWNER_MANAGER_ONLY : undefined}
                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-70"
              >
                <RefreshCw size={14} className={scanning ? 'spin-360' : ''} />
                {scanning ? 'Scanning…' : noAnalysis ? 'Run AI scan' : 'Re-scan Pipeline'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
