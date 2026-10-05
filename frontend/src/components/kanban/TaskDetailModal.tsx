import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Layers,
  Play,
  RotateCcw,
  Send,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ArtifactType, KanbanTask, TaskStatus, UserSummary } from '../../types/kanban.types'
import { ARTIFACT_TYPE_OPTIONS, artifactLabel, isValidArtifactUrl } from '../../utils/artifactLabel'
import { fmtDayMonth } from '../../utils/date'
import { useDismiss } from '../../hooks/useDismiss'

const statusConfigs: Record<
  TaskStatus,
  { label: string; badgeClass: string; Icon: typeof Clock }
> = {
  TODO: {
    label: 'To Do',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    Icon: Clock,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    Icon: Play,
  },
  REVIEW: {
    label: 'In Review',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    Icon: Clock,
  },
  DONE: {
    label: 'Done',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: Check,
  },
}

export interface TaskDetailModalProps {
  task: KanbanTask
  actor: UserSummary
  members: UserSummary[]
  pending?: boolean
  onClose: () => void
  onMove: (to: TaskStatus) => void
  onSubmitArtifact?: (form: { type: ArtifactType; url: string; note: string }) => Promise<boolean>
}

export function TaskDetailModal({
  task,
  actor,
  members,
  pending = false,
  onClose,
  onMove,
  onSubmitArtifact,
}: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])
  useDismiss(true, close, [modalRef])

  const [showAttachForm, setShowAttachForm] = useState(false)
  const [artType, setArtType] = useState<ArtifactType>('PR')
  const [artUrl, setArtUrl] = useState('')
  const [artNote, setArtNote] = useState('')
  const [artError, setArtError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOwner = actor.projectRole === 'OWNER'
  const assignee = members.find((member) => member.id === task.assignedUserId) || actor
  const statusCfg = statusConfigs[task.status]

  const handleAttachSubmit = async () => {
    if (!isValidArtifactUrl(artUrl)) {
      setArtError('Please enter a valid URL starting with http:// or https://')
      return
    }
    if (!onSubmitArtifact) return

    setIsSubmitting(true)
    setArtError('')
    try {
      const ok = await onSubmitArtifact({ type: artType, url: artUrl, note: artNote })
      if (ok) {
        setArtUrl('')
        setArtNote('')
        setShowAttachForm(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onMouseDown={onClose}
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="pop-in relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* ── Modal Header ── */}
        <header className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
              {task.code}
            </span>
            <span className="truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {task.phaseLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusCfg.badgeClass}`}
            >
              <statusCfg.Icon size={12} />
              {statusCfg.label}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </header>

        {/* ── Modal Body ── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Title */}
          <div>
            <h2 id="task-detail-title" className="text-lg font-bold leading-snug text-slate-900">
              {task.title}
            </h2>
          </div>

          {/* Meta Info Grid: Assignee & Due Date */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:grid-cols-2">
            {/* Assignee */}
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-1 ring-white ${
                  assignee.avatarClass || 'bg-indigo-500'
                }`}
              >
                {assignee.initials}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Assignee
                </span>
                <span className="block truncate text-xs font-bold text-slate-800">
                  {assignee.name}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {assignee.roleTitle}
                </span>
              </div>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-2.5 border-t border-slate-200/60 pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  task.isOverdue ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Due Date
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold ${
                      task.isOverdue ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {fmtDayMonth(task.dueDate)}
                  </span>
                  {task.isOverdue && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                      <AlertCircle size={10} />
                      Overdue
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Description
            </h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs leading-relaxed text-slate-700">
              {task.description || 'No description provided.'}
            </div>
          </div>

          {/* DAG Prerequisites & Join Rules */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Prerequisites & DAG Rules
            </h3>
            <div className="flex items-center gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs font-medium text-indigo-900">
              <Layers size={16} className="shrink-0 text-indigo-500" />
              <span>{task.joinPolicySummary}</span>
            </div>
          </div>

          {/* Deliverables & Evidence (Artifacts) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Deliverables & Evidence ({task.artifacts.length})
              </h3>
              {task.status !== 'DONE' && !showAttachForm && (
                <button
                  type="button"
                  onClick={() => setShowAttachForm(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  + Add Deliverable
                </button>
              )}
            </div>

            {/* List of artifacts */}
            {task.artifacts.length === 0 && !showAttachForm ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                No deliverables attached yet.
              </div>
            ) : (
              <div className="space-y-2">
                {task.artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <FileText size={15} />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {artifactLabel(artifact)}
                        </span>
                        {artifact.note && (
                          <span className="block truncate text-[11px] text-slate-500">
                            {artifact.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <span>Open</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Attach Form */}
            {showAttachForm && (
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Attach Deliverable Link</span>
                  <button
                    type="button"
                    onClick={() => setShowAttachForm(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Deliverable Type
                  </label>
                  <select
                    value={artType}
                    onChange={(e) => setArtType(e.target.value as ArtifactType)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                  >
                    {ARTIFACT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Deliverable URL
                  </label>
                  <input
                    value={artUrl}
                    onChange={(e) => {
                      setArtUrl(e.target.value)
                      setArtError('')
                    }}
                    placeholder="https://github.com/... or https://figma.com/..."
                    className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none ${
                      artError
                        ? 'border-red-300 focus:ring-1 focus:ring-red-200'
                        : 'border-slate-200 focus:border-indigo-400'
                    }`}
                  />
                  {artError && <span className="mt-1 block text-[10px] text-red-600">{artError}</span>}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Notes / Comments
                  </label>
                  <textarea
                    rows={2}
                    value={artNote}
                    onChange={(e) => setArtNote(e.target.value)}
                    placeholder="Brief description or verification notes..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAttachForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleAttachSubmit()}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Upload size={13} />
                    {isSubmitting ? 'Submitting…' : 'Save & Attach'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Modal Footer: Action Buttons ── */}
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {/* TODO Actions */}
            {task.status === 'TODO' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onMove('IN_PROGRESS')}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Play size={13} />
                Start Task
              </button>
            )}

            {/* IN_PROGRESS Actions */}
            {task.status === 'IN_PROGRESS' && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onMove('TODO')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Undo2 size={13} />
                  Revert to To Do
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onMove('REVIEW')}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                >
                  <Send size={13} />
                  Submit for Review
                </button>
              </>
            )}

            {/* REVIEW Actions */}
            {task.status === 'REVIEW' &&
              (isOwner ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onMove('IN_PROGRESS')}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Request Changes
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onMove('DONE')}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={13} />
                    Approve
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-medium text-violet-700">
                  <Clock size={13} />
                  Pending Review (Awaiting Owner)
                </span>
              ))}

            {/* DONE State */}
            {task.status === 'DONE' && (
              <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
                <Check size={13} />
                Completed & Verified
              </span>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
