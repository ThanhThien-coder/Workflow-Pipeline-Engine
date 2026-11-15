import { Layers, Search } from 'lucide-react'
import type { KanbanTask, PhaseFilterId } from '../../types/kanban.types'

/** Lựa chọn lọc phase: một mục cho mỗi phase thật có trong danh sách task (giữ thứ tự xuất hiện) kèm số task. */
function phaseOptions(tasks: KanbanTask[]): { id: string; label: string; count: number }[] {
  const seen = new Map<string, { label: string; count: number }>()
  for (const task of tasks) {
    if (!task.phaseId) continue
    const entry = seen.get(task.phaseId)
    if (entry) entry.count += 1
    else seen.set(task.phaseId, { label: task.phaseLabel || `Phase ${task.phaseId}`, count: 1 })
  }
  return Array.from(seen, ([id, { label, count }]) => ({ id, label, count }))
}

/**
 * G16: lọc phase bằng một ô chọn chiều rộng cố định (trước là mỗi phase một nút, nhiều phase thì tràn dòng).
 */
export function KanbanToolbar({ query, phase, tasks, onQuery, onPhase }: { query: string; phase: PhaseFilterId; tasks: KanbanTask[]; onQuery: (value: string) => void; onPhase: (value: PhaseFilterId) => void }) {
  const phases = phaseOptions(tasks)
  // Phase đang lọc không còn task nào (vd. vừa đổi dữ liệu): vẫn giữ một mục để ô chọn không bị lệch giá trị
  const missing = phase !== 'ALL' && !phases.some((item) => item.id === phase)

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="relative">
        <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search by title or task code…"
          className="w-72 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>
      <label className="relative flex items-center">
        <Layers size={14} className="pointer-events-none absolute left-2.5 text-slate-400" />
        <select
          aria-label="Lọc theo phase"
          value={phase}
          onChange={(event) => onPhase(event.target.value)}
          className={`w-64 truncate rounded-lg border bg-white py-1.5 pl-8 pr-7 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
            phase === 'ALL' ? 'border-slate-200 text-slate-600' : 'border-indigo-300 font-semibold text-indigo-700'
          }`}
        >
          <option value="ALL">Tất cả phase ({tasks.length})</option>
          {phases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.count})
            </option>
          ))}
          {missing && <option value={phase}>Phase {phase} (0)</option>}
        </select>
      </label>
      <div className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">Total: {tasks.length} tasks <span className="text-slate-300">|</span> <b className="text-blue-600">In Progress: {tasks.filter((task) => task.status === 'IN_PROGRESS').length}</b> <span className="text-slate-300">|</span> <b className={tasks.some((task) => task.isOverdue) ? 'text-red-600' : ''}>Overdue: {tasks.filter((task) => task.isOverdue).length}</b></div>
    </div>
  )
}
