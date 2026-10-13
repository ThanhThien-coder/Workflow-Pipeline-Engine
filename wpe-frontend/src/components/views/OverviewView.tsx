import { useEffect } from 'react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { OverviewHeader } from '../overview/OverviewHeader'
import { MetricRibbon } from '../overview/MetricRibbon'
import { WeeklyVelocityCard } from '../overview/WeeklyVelocityCard'
import { StatusBreakdownCard } from '../overview/StatusBreakdownCard'
import { FeedbackQueueCard } from '../overview/FeedbackQueueCard'
import { RecentActivityCard } from '../overview/RecentActivityCard'

export function OverviewView({ projectId }: { projectId: string }) {
  const data = useWorkflowStore((state) => state.overview.data)
  const status = useWorkflowStore((state) => state.overview.status)
  const error = useWorkflowStore((state) => state.overview.error)
  const load = useWorkflowStore((state) => state.overview.load)
  const revokeGuest = useWorkflowStore((state) => state.overview.revokeGuest)
  const generateGuest = useWorkflowStore((state) => state.overview.generateGuest)
  const resolveFeedback = useWorkflowStore((state) => state.overview.resolveFeedback)
  const toast = useWorkflowStore((state) => state.overview.toast)
  const showToast = useWorkflowStore((state) => state.overview.showToast)
  useEffect(() => { if (status === 'idle') void load(projectId) }, [load, projectId, status])
  if (status === 'loading' && !data) return <div className="grid min-h-full place-items-center bg-slate-50 text-sm text-slate-500">Loading Overview…</div>
  if (status === 'error' && !data) return <div className="grid min-h-full place-items-center bg-slate-50"><div className="text-center"><p className="text-sm text-red-600">{error}</p><button type="button" onClick={() => void load(projectId)} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Retry</button></div></div>
  if (!data) return null
  return <div className="h-full w-full overflow-y-auto bg-slate-50 font-sans text-slate-800"><OverviewHeader project={data.project} aiReport={data.aiReport} guestAccess={data.guestAccess} onRevoke={revokeGuest} onGenerate={generateGuest} notify={showToast} /><main className="mx-auto max-w-7xl space-y-6 px-6 py-6 pb-16"><MetricRibbon metrics={data.metrics} /><div className="grid grid-cols-12 gap-6"><div className="col-span-12 lg:col-span-8"><section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><WeeklyVelocityCard velocity={data.velocity} /><StatusBreakdownCard breakdown={data.statusBreakdown} /></section></div><aside className="col-span-12 space-y-6 lg:col-span-4"><FeedbackQueueCard items={data.feedbackQueue} onResolve={(item) => void resolveFeedback(item.id)} /><RecentActivityCard items={data.recentActivity} /></aside></div></main>{toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">{toast}</div>}</div>
}
