import { useState } from 'react'
import { X, Trash2, Check, Calendar, User, AlignLeft, Layers, Unlock, Play, Send, Undo2, CheckCircle2, Circle } from 'lucide-react'
import type { BranchGraphNode, NodeStatus } from '../../types/workflow.types'
import type { TaskStatus, UserSummary } from '../../types/kanban.types'
import { findMember } from '../../utils/memberLookup'
import { isUnlockSatisfied, type Prerequisite } from '../../utils/taskPrerequisites'
import { dueDateError, minDueDateInput } from '../../utils/dueDate'
import { dueDateLockReason } from '../../utils/dueDateLock'
import { GRAPH_READ_ONLY_MESSAGE } from '../../store/useWorkflowStore'

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-800 outline-none hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:hover:border-slate-200'

const SECTION_TITLE = 'text-[11px] font-bold uppercase tracking-wider text-slate-400'

/** Nhãn trạng thái chỉ để hiển thị: trạng thái đổi bằng nút hành động theo đúng luồng, không chọn tự do. */
const STATUS_LABEL: Record<NodeStatus, { text: string; className: string }> = {
  LOCKED: { text: '🔒 Locked', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  TODO: { text: 'To Do', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  IN_PROGRESS: { text: 'In Progress', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  REVIEW: { text: 'In Review', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  DONE: { text: 'Done', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const ACTION_BUTTON =
  'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50'

export interface NodePropertiesModalProps {
  node: BranchGraphNode
  members?: UserSummary[]
  /** Các task đứng trước (task cha cùng phase + ghost phase khác). */
  prerequisites?: Prerequisite[]
  /** Người đang xem: để biết có phải người được giao task không. */
  viewerId?: string | null
  /** Chủ dự án: được mở khóa sớm. */
  isOwner?: boolean
  /** Chủ dự án / quản lý: được duyệt hoặc trả lại task đang chờ duyệt. */
  canReview?: boolean
  onClose: () => void
  onDelete: () => void
  onSave?: (updated: Partial<BranchGraphNode>) => void
  /** Có thì hiện nút "Mở khóa sớm" (chủ dự án, task đang khóa). */
  onForceUnlock?: () => void
  /** Có thì hiện nút đổi trạng thái theo luồng (Bắt đầu, Nộp để duyệt, Duyệt, Trả lại). */
  onMoveStatus?: (to: TaskStatus, rejectReason?: string) => void
  /** Không phải chủ dự án: các ô thông tin chỉ xem (nút hành động của người được giao vẫn hiện). */
  readOnly?: boolean
}

export function NodePropertiesModal({
  node,
  members,
  prerequisites = [],
  viewerId,
  isOwner = false,
  canReview = false,
  onClose,
  onDelete,
  onSave,
  onForceUnlock,
  onMoveStatus,
  readOnly = false,
}: NodePropertiesModalProps) {
  const [title, setTitle] = useState(node.title)
  const memberList = members ?? []
  const currentAssignee = findMember(memberList, node.assignee)
  // Người đang được giao không còn trong danh sách (đã rời dự án): giữ nguyên id để lưu không tự bỏ giao
  const missingAssigneeId = node.assignee && !currentAssignee ? node.assignee : null
  const [assignee, setAssignee] = useState(currentAssignee?.id ?? missingAssigneeId ?? '')
  const [due, setDue] = useState(node.due ?? '')
  const [join, setJoin] = useState<'ALL' | 'ANY'>(node.joinPolicy === 'ANY_COMPLETED' ? 'ANY' : 'ALL')
  const [description, setDescription] = useState(node.description || '')
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const status = STATUS_LABEL[node.status]
  const unfinished = prerequisites.filter((p) => !p.done)
  const doneCount = prerequisites.length - unfinished.length
  const satisfied = isUnlockSatisfied(prerequisites, join === 'ANY' ? 'ANY_COMPLETED' : 'ALL_COMPLETED')
  const isAssignee = Boolean(viewerId && currentAssignee?.id === viewerId)
  const dueLockReason = dueDateLockReason(node)
  // G21: hạn chót không sớm hơn ngày tạo task (chỉ kiểm khi đổi ngày, ngày cũ đã lưu thì để nguyên)
  const dueError = !dueLockReason && due !== (node.due ?? '') ? dueDateError(due, node.createdAt) : null

  const handleSave = () => {
    if (dueError) return
    onSave?.({
      title: title.trim() || node.title,
      assignee: assignee || null,
      due: due || null,
      joinPolicy: join === 'ANY' ? 'ANY_COMPLETED' : 'ALL_COMPLETED',
      description: description.trim(),
    })
    onClose()
  }

  const requestForceUnlock = () => {
    if (unfinished.length > 0) setConfirmUnlock(true)
    else onForceUnlock?.()
  }

  const move = (to: TaskStatus, reason?: string) => {
    onMoveStatus?.(to, reason)
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
        {/* Đầu hộp: mã · tên, nhãn trạng thái */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-tight">Task Details</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              <span className="font-mono font-semibold text-indigo-600">{node.code || node.id}</span> · {node.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span data-testid="node-status" className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${status.className}`}>
                {status.text}
              </span>
              {node.forceUnlocked && (
                <span className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  Unlocked early
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            title="Close"
            className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {readOnly && (
          <div className="px-5 py-2 text-xs font-medium text-slate-600 bg-slate-50 border-b border-slate-100 shrink-0">
            {GRAPH_READ_ONLY_MESSAGE}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-white">
          {/* Khung điều kiện: task đứng trước */}
          {prerequisites.length > 0 && (
            <div data-testid="prerequisites" className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
              <p className="text-xs font-semibold text-slate-700">
                {node.status === 'LOCKED' ? '⏳ Waiting: ' : 'Prerequisites: '}
                {doneCount}/{prerequisites.length} prerequisites done ({join === 'ANY' ? 'any one' : 'all required'})
                {node.status === 'LOCKED' && satisfied && ' · ready (unlocks when the project is published)'}
              </p>
              <ul className="mt-2 space-y-1">
                {prerequisites.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                    {p.done ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" /> : <Circle size={13} className="shrink-0 text-slate-400" />}
                    <span className="font-mono text-[11px] text-slate-500">{p.code}</span>
                    <span className="truncate">{p.title}</span>
                    {p.external && p.phaseTitle && <span className="shrink-0 text-[10px] text-slate-400">· {p.phaseTitle}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nút hành động theo vai trò và trạng thái */}
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            {node.status === 'LOCKED' && isOwner && onForceUnlock && !confirmUnlock && (
              <button type="button" onClick={requestForceUnlock} className={`${ACTION_BUTTON} bg-amber-500 text-white hover:bg-amber-600`}>
                <Unlock size={13} /> Unlock early
              </button>
            )}
            {node.status === 'TODO' && isAssignee && onMoveStatus && (
              <button type="button" onClick={() => move('IN_PROGRESS')} className={`${ACTION_BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
                <Play size={13} /> Start
              </button>
            )}
            {node.status === 'IN_PROGRESS' && isAssignee && onMoveStatus && (
              <button type="button" onClick={() => move('REVIEW')} className={`${ACTION_BUTTON} bg-violet-600 text-white hover:bg-violet-700`}>
                <Send size={13} /> Submit for review
              </button>
            )}
            {node.status === 'REVIEW' && canReview && onMoveStatus && !rejecting && (
              <>
                <button type="button" onClick={() => move('DONE')} className={`${ACTION_BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`}>
                  <Check size={13} /> Approve
                </button>
                <button type="button" onClick={() => setRejecting(true)} className={`${ACTION_BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                  <Undo2 size={13} /> Request changes
                </button>
              </>
            )}
          </div>

          {/* Xác nhận mở khóa sớm khi còn task trước chưa xong */}
          {confirmUnlock && (
            <div role="alertdialog" className="mx-5 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
              <p className="font-semibold">Heads up: this task is still waiting on:</p>
              <ul className="mt-1 list-disc pl-4">
                {unfinished.map((p) => (
                  <li key={p.id}>
                    <span className="font-mono">{p.code}</span> {p.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Unlocking early lets the assignee start right away. Unlock anyway?</p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmUnlock(false)} className={`${ACTION_BUTTON} border border-amber-200 bg-white text-amber-800 shadow-none`}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmUnlock(false)
                    onForceUnlock?.()
                  }}
                  className={`${ACTION_BUTTON} bg-amber-500 text-white hover:bg-amber-600`}
                >
                  <Unlock size={13} /> Unlock anyway
                </button>
              </div>
            </div>
          )}

          {/* Trả lại kèm lý do */}
          {rejecting && (
            <div className="mx-5 mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for changes
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="What needs to change…"
                  className={`${INPUT} mt-1 resize-none`}
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setRejecting(false)} className={`${ACTION_BUTTON} border border-slate-200 bg-white text-slate-700 shadow-none`}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectReason.trim()}
                  onClick={() => move('IN_PROGRESS', rejectReason.trim())}
                  className={`${ACTION_BUTTON} bg-rose-600 text-white hover:bg-rose-700`}
                >
                  <Undo2 size={13} /> Request changes
                </button>
              </div>
            </div>
          )}

          {/* Thông tin task: chỉ xem thì fieldset khóa mọi ô */}
          <fieldset disabled={readOnly} className="px-5 py-4 space-y-4 min-w-0">
            <p className={SECTION_TITLE}>Assignment</p>
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <User size={13} className="text-indigo-600" />
                Assignee
              </span>
              <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className={INPUT}>
                <option value="" className="bg-white text-slate-900 py-1">
                  Unassigned
                </option>
                {memberList.filter((member) => member.projectRole !== 'VIEWER' || member.id === node.assignee).map((member) => (
                  <option key={member.id} value={member.id} className="bg-white text-slate-900 py-1">
                    {member.name}
                  </option>
                ))}
                {missingAssigneeId && (
                  <option value={missingAssigneeId} className="bg-white text-slate-500 py-1">
                    User no longer in this project
                  </option>
                )}
              </select>
            </label>
            <label className="block">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar size={13} className="text-indigo-600" />
                Due date
              </span>
              <input
                type="date"
                aria-label="Due date"
                min={minDueDateInput(node.createdAt)}
                value={due}
                disabled={Boolean(dueLockReason)}
                title={dueLockReason ?? undefined}
                onChange={(event) => setDue(event.target.value)}
                className={INPUT}
              />
              {dueError && (
                <span role="alert" className="mt-1 block text-[11px] font-medium text-red-600">{dueError}</span>
              )}
            </label>

            <p className={`${SECTION_TITLE} pt-1`}>Requirements</p>
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 mb-1.5">Task title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title…" className={INPUT} />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <AlignLeft size={13} className="text-indigo-600" />
                Description / deliverable
              </span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the work or the deliverable to submit…"
                className={`${INPUT} resize-none leading-relaxed`}
              />
            </label>
            <div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Layers size={13} className="text-indigo-600" />
                Unlock condition
              </span>
              <div className="flex gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="join" checked={join === 'ALL'} onChange={() => setJoin('ALL')} />
                  All prerequisites done
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="join" checked={join === 'ANY'} onChange={() => setJoin('ANY')} />
                  Any one prerequisite done
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Chân hộp */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/90 rounded-b-2xl shrink-0">
          {readOnly ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3.5 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete task</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:bg-slate-200/60 border border-slate-200 bg-white rounded-xl px-3.5 py-2 transition-colors cursor-pointer"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={Boolean(dueError)}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4 py-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} />
                <span>Save changes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

