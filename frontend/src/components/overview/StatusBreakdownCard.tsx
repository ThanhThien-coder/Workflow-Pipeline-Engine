import type { TaskStatusBreakdown } from '../../types/overview.types'

export function StatusBreakdownCard({ breakdown }: { breakdown: TaskStatusBreakdown }) {
  return <div className="mt-10 border-t border-slate-100 pt-8"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">Phân bổ trạng thái công việc</h3><span className="text-xs text-slate-500">Tổng {breakdown.totalTasks} tasks</span></div>
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">{breakdown.items.map((item) => <div key={item.status} className={`${item.barClass} transition-opacity hover:opacity-80`} style={{ width: `${item.percent}%` }} title={`${item.label}: ${item.percent}% · ${item.taskCount}/${breakdown.totalTasks} tasks`} />)}</div>
    <div className="mt-5 space-y-4">{breakdown.items.map((item) => <div key={item.status} className="group"><div className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />{item.label}</span><span className="text-slate-500"><b className="text-slate-800">{item.percent}%</b> · {item.taskCount} / {breakdown.totalTasks} tasks</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.barClass} transition-all group-hover:opacity-80`} style={{ width: `${item.percent}%` }} /></div></div>)}</div>
  </div>
}
