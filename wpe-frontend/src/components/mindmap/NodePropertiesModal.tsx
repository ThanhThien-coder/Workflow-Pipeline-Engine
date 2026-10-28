import { useState } from 'react'
import { X, Trash2, Check, Calendar, User, AlignLeft, Layers } from 'lucide-react'
import type { BranchGraphNode, NodeStatus } from '../../types/workflow.types'
import type { UserSummary } from '../../types/kanban.types'

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs'

export interface NodePropertiesModalProps {
  node: BranchGraphNode
  members?: UserSummary[]
  onClose: () => void
  onDelete: () => void
  onSave?: (updated: Partial<BranchGraphNode>) => void
}

export function NodePropertiesModal({
  node,
  members,
  onClose,
  onDelete,
  onSave,
}: NodePropertiesModalProps) {
  const [title, setTitle] = useState(node.title)
  const [status, setStatus] = useState<NodeStatus>(node.status)
  const [assignee, setAssignee] = useState(node.assignee ?? 'Unassigned')
  const [due, setDue] = useState(node.due ?? '')
  const [join, setJoin] = useState(node.joinPolicy === 'ANY_COMPLETED' ? 'ANY' : 'ALL')
  const [description, setDescription] = useState(node.description || '')

  const memberNames =
    members && members.length > 0
      ? members.map((m) => m.name)
      : ['Alex Kim', 'Sarah Chen', 'Marcus Liu', 'Jamie Doe']

  const assigneeList = Array.from(new Set([...memberNames, 'Unassigned']))

  const handleSave = () => {
    let newProgress = node.progress
    if (status === 'DONE') {
      newProgress = 100
    } else if (status === 'IN_PROGRESS' && (newProgress === 0 || newProgress == null)) {
      newProgress = 50
    } else if (status === 'TODO' || status === 'LOCKED') {
      newProgress = 0
    }

    onSave?.({
      title: title.trim() || node.title,
      status,
      progress: newProgress,
      assignee: assignee === 'Unassigned' ? null : assignee,
      due: due || null,
      joinPolicy: join === 'ANY' ? 'ANY_COMPLETED' : 'ALL_COMPLETED',
      description: description.trim(),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/40 backdrop-blur-xs select-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Node Properties
            </h3>
            <span className="inline-block text-[11px] font-semibold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mt-1">
              Task Code: {node.code || node.id}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            title="Close"
            className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 bg-white">
          {/* Task Name */}
          <label className="block">
            <span className="block text-xs font-bold text-slate-700 mb-1.5">
              Task Name
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter task name..."
              className={INPUT}
            />
          </label>

          {/* Assignee */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <User size={13} className="text-indigo-600" />
              Assignee
            </span>
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className={INPUT}
            >
              {assigneeList.map((name) => (
                <option
                  key={name}
                  value={name}
                  className="bg-white text-slate-900 py-1"
                >
                  {name}
                </option>
              ))}
            </select>
          </label>

          {/* Status & Deadline Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 mb-1.5">
                Status
                {node.isTrack && (
                  <span className="ml-1 font-normal text-slate-400">(tự động theo task)</span>
                )}
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as NodeStatus)}
                disabled={node.isTrack}
                title={node.isTrack ? 'Trạng thái Track được tính tự động từ các task bên trong' : undefined}
                className={`${INPUT} ${node.isTrack ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="TODO" className="bg-white text-slate-900">
                  TODO
                </option>
                <option value="IN_PROGRESS" className="bg-white text-slate-900">
                  IN_PROGRESS
                </option>
                <option value="REVIEW" className="bg-white text-slate-900">
                  REVIEW
                </option>
                <option value="DONE" className="bg-white text-slate-900">
                  DONE
                </option>
                <option value="LOCKED" className="bg-white text-slate-900">
                  LOCKED
                </option>
              </select>
            </label>

            {/* Deadline */}
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={13} className="text-indigo-600" />
                Deadline
              </span>
              <input
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
                className={INPUT}
              />
            </label>
          </div>

          {/* Join Logic */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <Layers size={13} className="text-indigo-600" />
              Join Logic (DAG Unlock Policy)
            </span>
            <select
              value={join}
              onChange={(event) => setJoin(event.target.value)}
              className={INPUT}
            >
              <option value="ALL" className="bg-white text-slate-900">
                ALL COMPLETED (AND-Join: All prerequisites required)
              </option>
              <option value="ANY" className="bg-white text-slate-900">
                ANY COMPLETED (OR-Join: Any prerequisite unlocks)
              </option>
            </select>
          </label>

          {/* Description */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <AlignLeft size={13} className="text-indigo-600" />
              Description
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Enter task description or deliverable requirements..."
              className={`${INPUT} resize-none leading-relaxed`}
            />
          </label>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/90 rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3.5 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete Node</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:bg-slate-200/60 border border-slate-200 bg-white rounded-xl px-3.5 py-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4 py-2 shadow-sm transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
