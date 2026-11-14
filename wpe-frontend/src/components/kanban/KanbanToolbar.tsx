import { Search } from 'lucide-react'
import type { KanbanTask, PhaseFilterId } from '../../types/kanban.types'

/** Nút lọc phase: một nút cho mỗi phase thật có trong danh sách task (giữ thứ tự xuất hiện), thêm "All". */
function phaseOptions(tasks: KanbanTask[]): { id: PhaseFilterId; label: string }[] {
  const seen = new Map<string, string>()
  for (const task of tasks) {
    if (task.phaseId && !seen.has(task.phaseId)) seen.set(task.phaseId, task.phaseLabel || `Phase ${task.phaseId}`)
  }
  return [{ id: 'ALL', label: 'All' }, ...Array.from(seen, ([id, label]) => ({ id, label }))]
}

export function KanbanToolbar({ query, phase, tasks, onQuery, onPhase }: { query: string; phase: PhaseFilterId; tasks: KanbanTask[]; onQuery: (value: string) => void; onPhase: (value: PhaseFilterId) => void }) {
  const phases = phaseOptions(tasks)
  return <div className="flex flex-wrap items-center gap-2.5"><label className="relative"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by title or task code…" className="w-72 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200" /></label><div className="flex flex-wrap rounded-lg bg-slate-100 p-1">{phases.map((item) => <button type="button" key={item.id} onClick={() => onPhase(item.id)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${phase === item.id ? 'bg-white text-indigo-700 shadow' : 'text-slate-500 hover:text-slate-800'}`}>{item.label}</button>)}</div><div className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">Total: {tasks.length} tasks <span className="text-slate-300">|</span> <b className="text-blue-600">In Progress: {tasks.filter((task) => task.status === 'IN_PROGRESS').length}</b> <span className="text-slate-300">|</span> <b className={tasks.some((task) => task.isOverdue) ? 'text-red-600' : ''}>Overdue: {tasks.filter((task) => task.isOverdue).length}</b></div></div>
}
