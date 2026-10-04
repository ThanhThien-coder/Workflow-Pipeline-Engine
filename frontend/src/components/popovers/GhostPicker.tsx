import { useState } from 'react'
import type { GraphNodeMap } from '../../types/workflow.types'

export function GhostPicker({ trees, currentPhase, anchorId, onConfirm, onClose }: { trees: Record<string, GraphNodeMap>; currentPhase: string; anchorId?: string; onConfirm: (value: { refPhase: string; refId: string; dir: 'up' | 'down'; anchorId?: string }) => void; onClose: () => void }) {
  const phases = Object.keys(trees).filter((id) => id !== currentPhase)
  const [phase, setPhase] = useState(phases[0] ?? '')
  const tasks = phase ? Object.values(trees[phase]).filter((node) => node.kind === 'branch' && !node.isTrack) : []
  const [task, setTask] = useState(tasks[0]?.id ?? '')
  const [dir, setDir] = useState<'up' | 'down'>('up')
  return <div className="space-y-3"><b className="text-sm text-slate-800">Thêm Ghost Node</b>
    <label className="block text-xs font-semibold text-slate-600">Phase nguồn<select value={phase} onChange={(e) => { setPhase(e.target.value); setTask(Object.values(trees[e.target.value] ?? {}).find((node) => node.kind === 'branch' && !node.isTrack)?.id ?? '') }} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs">{phases.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
    <label className="block text-xs font-semibold text-slate-600">Task nguồn<select value={task} onChange={(e) => setTask(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs">{tasks.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
    <div className="flex gap-3 text-xs"><label><input type="radio" checked={dir === 'up'} onChange={() => setDir('up')} /> Upstream</label><label><input type="radio" checked={dir === 'down'} onChange={() => setDir('down')} /> Downstream</label></div>
    <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">Hủy</button><button disabled={!phase || !task} onClick={() => onConfirm({ refPhase: phase, refId: task, dir, anchorId })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Thêm</button></div>
  </div>
}
