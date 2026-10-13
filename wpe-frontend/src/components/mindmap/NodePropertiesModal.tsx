import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { BranchGraphNode, NodeStatus } from '../../types/workflow.types'

const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
export function NodePropertiesModal({ node, onClose, onDelete }: { node: BranchGraphNode; onClose: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState(node.title)
  const [status, setStatus] = useState<NodeStatus>(node.status)
  const [assignee, setAssignee] = useState(node.assignee ?? 'Unassigned')
  const [due, setDue] = useState(node.due ?? '')
  const [join, setJoin] = useState(node.joinPolicy === 'ANY_COMPLETED' ? 'ANY' : 'ALL')
  const [description, setDescription] = useState(node.description)
  return <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0"><h3 className="text-[15px] font-bold text-slate-800">Node Properties</h3><button onClick={(event) => { event.stopPropagation(); onClose() }} title="Đóng" className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button></div>
      <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Task Name<input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} /></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Node ID<input value={node.code} readOnly disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500 font-mono cursor-not-allowed" /></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Assignee<select value={assignee} onChange={(event) => setAssignee(event.target.value)} className={INPUT}><option>Jamie Doe</option><option>Alex Kim</option><option>Marcus Liu</option><option>Sarah Chen</option><option>Unassigned</option></select></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Status<select value={status} onChange={(event) => setStatus(event.target.value as NodeStatus)} className={INPUT}><option>TODO</option><option>IN_PROGRESS</option><option>DONE</option><option>LOCKED</option><option>REVIEW</option></select></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Deadline<input type="date" value={due} onChange={(event) => setDue(event.target.value)} className={`${INPUT} pl-9`} /></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Join Logic<select value={join} onChange={(event) => setJoin(event.target.value)} className={INPUT}><option value="ALL">ALL COMPLETED</option><option value="ANY">ANY COMPLETED</option></select></label>
        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className={`${INPUT} resize-none leading-relaxed`} /></label>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 bg-slate-50/60 rounded-b-2xl shrink-0"><button onClick={(event) => { event.stopPropagation(); onDelete() }} className="flex items-center gap-1.5 text-[12.5px] font-semibold rounded-lg px-3 py-2 text-rose-500 bg-rose-50 hover:bg-rose-100"><Trash2 size={13} />Delete Node</button><button onClick={onClose} className="text-[12.5px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 shadow-sm">Save Changes</button></div>
    </div>
  </div>
}
