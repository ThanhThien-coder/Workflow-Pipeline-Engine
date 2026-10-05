import { AlertCircle, CheckCircle2, GitBranch, MessageCircle } from 'lucide-react'
import type { OverviewMetrics } from '../../types/overview.types'
import { ProgressRing } from '../common/ProgressRing'

export function MetricRibbon({ metrics }: { metrics: OverviewMetrics }) {
  const cards = [
    { label: 'Total Nodes', value: metrics.totalNodes, sub: `${metrics.criticalPathNodes} nodes on critical path`, icon: <GitBranch size={17} />, cls: 'bg-indigo-100 text-indigo-700' },
    { label: 'Completion', value: `${metrics.completionRate}%`, sub: `${metrics.completedNodes} / ${metrics.totalNodes} nodes completed`, icon: <CheckCircle2 size={17} />, cls: 'bg-emerald-100 text-emerald-700', ring: <ProgressRing percent={metrics.completionRate} /> },
    { label: 'Overdue', value: metrics.overdueCount, sub: `${metrics.blockingReleaseCount} blocking release`, icon: <AlertCircle size={17} />, cls: 'bg-rose-100 text-rose-700', badge: 'Action Required' },
    { label: 'Pending Review', value: metrics.pendingReviewCount, sub: `${metrics.pendingReviewCount} feedbacks awaiting response`, icon: <MessageCircle size={17} />, cls: 'bg-amber-100 text-amber-700', badge: 'Review' },
  ]
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className="fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
    <div className="flex items-start justify-between"><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><span className={`rounded-lg p-2 ${card.cls}`}>{card.icon}</span>{card.label}</div>{card.badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${card.cls}`}>{card.badge}</span>}</div>
    <div className="mt-4 flex items-end justify-between"><div><div className="text-4xl font-bold tracking-tight">{card.value}</div><div className="mt-1 text-xs text-slate-500">{card.sub}</div></div>{card.ring}</div>
  </div>)}</div>
}
