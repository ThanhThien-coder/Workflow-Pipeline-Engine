import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Send,
  Undo2,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ArtifactType, KanbanTask, ReopenImpact, TaskStatus, UserSummary } from '../../types/kanban.types'
import { ReopenTaskModal } from './ReopenTaskModal'
import { DELIVERABLE_NAME_MAX, artifactLabel, isValidArtifactUrl } from '../../utils/artifactLabel'
import { SiteIcon, hostOf, siteLabel } from '../common/SiteIcon'
import { fmtDueDate } from '../../utils/date'
import { dateInputToEndOfDayIso, dueDateError, isoToDateInput, minDueDateInput } from '../../utils/dueDate'
import { dueDateLockReason, friendlyLockMessage } from '../../utils/dueDateLock'
import { useDismiss } from '../../hooks/useDismiss'
import { getSavedAvatar } from '../../utils/avatarUtils'
import { navigate } from '../../router/useRouter'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { selectProjectStatus } from '../../store/projectInfo'
import { isMemberWorkLocked } from '../../domain/projectWork'
import { ProjectNotActiveBanner } from '../common/ProjectNotActiveBanner'

const statusConfigs: Record<
  TaskStatus,
  { label: string; badgeClass: string; Icon: typeof Clock }
> = {
  LOCKED: {
    label: 'Locked',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    Icon: Lock,
  },
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

/** S04: artifact nộp trước lúc mở lại task thì hiện nhãn "Before reopen". */
function isBeforeReopen(uploadedAt: string | undefined, reopenedAt: string | undefined): boolean {
  if (!uploadedAt || !reopenedAt) return false
  const up = Date.parse(uploadedAt)
  const re = Date.parse(reopenedAt)
  return !Number.isNaN(up) && !Number.isNaN(re) && up < re
}

export interface TaskDetailModalProps {
  task: KanbanTask
  actor: UserSummary
  members: UserSummary[]
  pending?: boolean
  onClose: () => void
  onMove: (to: TaskStatus, rejectReason?: string) => void
  onSubmitArtifact?: (form: { type?: ArtifactType; url: string; name: string }) => Promise<boolean>
  onUpdateAssignment?: (cmd: { assignedUserId?: string; dueDate?: string }) => Promise<boolean>
  /** S04: mở lại task Done (chỉ hiện nút khi có cả hai prop này và người xem là Owner/Manager). */
  onReopen?: (reason: string) => Promise<boolean>
  getReopenImpact?: () => Promise<ReopenImpact>
}

export function TaskDetailModal({
  task,
  actor,
  members,
  pending = false,
  onClose,
  onMove,
  onSubmitArtifact,
  onUpdateAssignment,
  onReopen,
  getReopenImpact,
}: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const rejectModalRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => onClose(), [onClose])

  // Rejection reason state for REVIEW -> IN_PROGRESS
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReasonInput, setRejectReasonInput] = useState('')
  const [rejectReasonError, setRejectReasonError] = useState('')

  const [showReopenModal, setShowReopenModal] = useState(false)

  useDismiss(!showRejectModal && !showReopenModal, close, [modalRef])

  const [showAttachForm, setShowAttachForm] = useState(false)
  const [artUrl, setArtUrl] = useState('')
  const [artName, setArtName] = useState('')
  const [artError, setArtError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle Escape key specifically for the reject submodal
  useEffect(() => {
    if (!showRejectModal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setShowRejectModal(false)
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [showRejectModal])

  // Dự án chưa chạy (không ACTIVE): Cộng tác viên chỉ xem task (backend trả 409 PROJECT_NOT_ACTIVE).
  // Dự án ARCHIVED: mọi người chỉ xem, kể cả owner/manager (không duyệt, giao việc, mở lại task).
  const projectStatus = useWorkflowStore(selectProjectStatus)
  const canReview = projectStatus !== 'ARCHIVED' && (actor.projectRole === 'OWNER' || actor.projectRole === 'MANAGER')
  const workLocked = isMemberWorkLocked(projectStatus, actor.projectRole)
  const assignee = members.find((member) => member.id === task.assignedUserId) || actor
  const assigneeAvatar = assignee.avatarUrl || getSavedAvatar(assignee.name || assignee.id)
  const statusCfg = statusConfigs[task.status]

  const toDateInput = (iso?: string): string => isoToDateInput(iso)

  const [assignedUserId, setAssignedUserId] = useState(task.assignedUserId ?? '')
  const [dueDateInput, setDueDateInput] = useState(toDateInput(task.dueDate))
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  useEffect(() => {
    setAssignedUserId(task.assignedUserId ?? '')
    setDueDateInput(toDateInput(task.dueDate))
    setAssignmentError(null)
  }, [task.id, task.assignedUserId, task.dueDate])

  const initialDateStr = toDateInput(task.dueDate)
  const isAssigneeChanged = assignedUserId !== (task.assignedUserId ?? '')
  const isDueDateChanged = dueDateInput !== initialDateStr
  const hasAssignmentChanges = isAssigneeChanged || isDueDateChanged
  const dueLockReason = dueDateLockReason(task)
  // G21: hạn chót không sớm hơn ngày tạo task (chỉ kiểm khi người dùng đổi ngày)
  const dueError = !dueLockReason && isDueDateChanged ? dueDateError(dueDateInput, task.createdAt) : null

  const handleSaveAssignment = async () => {
    if (!onUpdateAssignment || !hasAssignmentChanges || dueError) return
    setIsSavingAssignment(true)
    setAssignmentError(null)
    try {
      const cmd: { assignedUserId?: string; dueDate?: string } = {}
      if (isAssigneeChanged) {
        cmd.assignedUserId = assignedUserId
      }
      if (isDueDateChanged && !dueLockReason) {
        cmd.dueDate = dateInputToEndOfDayIso(dueDateInput)
      }
      await onUpdateAssignment(cmd)
    } catch (err) {
      setAssignmentError(friendlyLockMessage(err) || 'Unable to update assignment. Please try again.')
    } finally {
      setIsSavingAssignment(false)
    }
  }

  const handleConfirmReject = () => {
    const trimmed = rejectReasonInput.trim()
    if (!trimmed) {
      setRejectReasonError('Please provide a rejection reason (required).')
      return
    }
    setShowRejectModal(false)
    onMove('IN_PROGRESS', trimmed)
    onClose()
  }

  const trimmedArtUrl = artUrl.trim()
  const showArtSitePreview = isValidArtifactUrl(trimmedArtUrl) && Boolean(hostOf(trimmedArtUrl))

  const handleAttachSubmit = async () => {
    if (!isValidArtifactUrl(artUrl)) {
      setArtError('Please enter a valid URL starting with http:// or https://')
      return
    }
    if (!onSubmitArtifact) return

    setIsSubmitting(true)
    setArtError('')
    try {
      const ok = await onSubmitArtifact({ url: trimmedArtUrl, name: artName.trim() })
      if (ok) {
        setArtUrl('')
        setArtName('')
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
        data-lenis-prevent
        className="pop-in relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
          {/* Rejection Alert Banner (when changes requested) */}
          {workLocked && <ProjectNotActiveBanner projectStatus={projectStatus} />}

          {task.status === 'IN_PROGRESS' && task.rejectReason && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1">
                <span className="font-bold text-amber-900">
                  {task.reopenedAt ? 'Reopened:' : 'Changes Requested by Reviewer:'}
                </span>
                <p className="whitespace-pre-wrap text-amber-800">{task.rejectReason}</p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <h2 id="task-detail-title" className="text-lg font-bold leading-snug text-slate-900">
              {task.title}
            </h2>
          </div>

          {/* Meta Info Grid: Assignee & Due Date */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:grid-cols-2">
            {/* Assignee */}
            <div
              role={assignee.id ? 'link' : undefined}
              tabIndex={assignee.id ? 0 : undefined}
              title={assignee.id ? 'View profile' : undefined}
              aria-label={assignee.id ? `View profile of ${assignee.name}` : undefined}
              onClick={assignee.id ? () => navigate('/people/' + assignee.id) : undefined}
              onKeyDown={
                assignee.id
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate('/people/' + assignee.id)
                      }
                    }
                  : undefined
              }
              className={`flex items-center gap-2.5 rounded-lg ${
                assignee.id ? 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-400' : ''
              }`}
            >
              {assigneeAvatar ? (
                <img
                  src={assigneeAvatar}
                  alt={assignee.name}
                  className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-white"
                />
              ) : (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-1 ring-white ${
                    assignee.avatarClass || 'bg-indigo-500'
                  }`}
                >
                  {assignee.initials}
                </div>
              )}
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
                    {fmtDueDate(task.dueDate)}
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

          {/* Assignment Section for Owner/Manager */}
          {canReview && task.status !== 'DONE' && Boolean(onUpdateAssignment) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User size={14} className="text-indigo-600" />
                  Assignment
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="assignment-assignee-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Assignee
                  </label>
                  <select
                    id="assignment-assignee-select"
                    aria-label="Assignee"
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                  >
                    {members.filter((member) => member.projectRole !== 'VIEWER' || member.id === task.assignedUserId).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.roleTitle || member.projectRole})
                      </option>
                    ))}
                    {task.assignedUserId && !members.some((m) => m.id === task.assignedUserId) && (
                      <option value={task.assignedUserId}>
                        {assignee.name || task.assignedUserId}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="assignment-due-date-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Due date
                  </label>
                  <input
                    id="assignment-due-date-input"
                    aria-label="Due date"
                    type="date"
                    min={minDueDateInput(task.createdAt)}
                    value={dueDateInput}
                    disabled={Boolean(dueLockReason)}
                    title={dueLockReason ?? undefined}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>
              {(dueError || assignmentError) && (
                <p role="alert" className="text-[11px] font-medium text-red-600">{dueError || assignmentError}</p>
              )}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={!hasAssignmentChanges || Boolean(dueError) || isSavingAssignment || pending}
                  onClick={() => void handleSaveAssignment()}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Check size={13} />
                  {isSavingAssignment ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </div>
          )}

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
              {task.status !== 'DONE' && !showAttachForm && !workLocked && (
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <SiteIcon url={artifact.url} size={16} />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {artifactLabel(artifact)}
                          {isBeforeReopen(artifact.uploadedAt, task.reopenedAt) && (
                            <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-slate-600">
                              Before reopen
                            </span>
                          )}
                        </span>
                        {artifact.note && artifact.note !== artifactLabel(artifact) && (
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
                  <label htmlFor="task-detail-artifact-url" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Deliverable URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="task-detail-artifact-url"
                      value={artUrl}
                      onChange={(e) => {
                        setArtUrl(e.target.value)
                        setArtError('')
                      }}
                      placeholder="https://github.com/... or https://figma.com/..."
                      className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none ${
                        artError
                          ? 'border-red-300 focus:ring-1 focus:ring-red-200'
                          : 'border-slate-200 focus:border-indigo-400'
                      }`}
                    />
                    {showArtSitePreview && (
                      <span
                        data-testid="task-detail-artifact-site-preview"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700"
                      >
                        <SiteIcon url={trimmedArtUrl} size={14} />
                        <span>{siteLabel(trimmedArtUrl)}</span>
                      </span>
                    )}
                  </div>
                  {artError && <span className="mt-1 block text-[10px] text-red-600">{artError}</span>}
                </div>
                <div>
                  <label htmlFor="task-detail-artifact-name" className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Deliverable name <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    id="task-detail-artifact-name"
                    value={artName}
                    maxLength={DELIVERABLE_NAME_MAX}
                    onChange={(e) => setArtName(e.target.value)}
                    placeholder="e.g. Login screen design, API pull request"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                  />
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Shown in the Artifacts list. Leave blank to use &quot;Artifact {task.code}&quot;.
                  </span>
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
            {task.status === 'TODO' && !workLocked && (
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
            {task.status === 'IN_PROGRESS' && !workLocked && (
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
              (canReview ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setRejectReasonInput('')
                      setRejectReasonError('')
                      setShowRejectModal(true)
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Request Changes
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      onMove('DONE')
                      onClose()
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={13} />
                    Approve
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-medium text-violet-700">
                  <Clock size={13} />
                  Pending Review (Awaiting Owner/Manager)
                </span>
              ))}

            {/* DONE State */}
            {task.status === 'DONE' && (
              <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
                <Check size={13} />
                Completed & Verified
              </span>
            )}
            {task.status === 'DONE' && canReview && onReopen && getReopenImpact && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowReopenModal(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:opacity-50"
              >
                <RotateCcw size={13} />
                Reopen task
              </button>
            )}
          </div>
        </footer>
      </div>

      {showReopenModal && onReopen && getReopenImpact && (
        <ReopenTaskModal
          task={task}
          loadImpact={getReopenImpact}
          onConfirm={onReopen}
          onClose={() => setShowReopenModal(false)}
        />
      )}

      {/* ── Sub-modal: Request Changes Confirmation (Mandatory Reject Reason) ── */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowRejectModal(false)}
          />
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            className="pop-in relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 id="reject-modal-title" className="text-sm font-bold text-slate-900">
                    Request Changes (Reject Review)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Move {task.code} back to IN PROGRESS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please enter the reason for rejection so the assignee understands what needs to be revised or improved.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => {
                  setRejectReasonInput(e.target.value)
                  setRejectReasonError('')
                }}
                placeholder="e.g. Missing technical specs, unit tests failed, need benchmark results..."
                className={`w-full rounded-xl border p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none ${
                  rejectReasonError
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200'
                }`}
              />
              {rejectReasonError && (
                <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
                  {rejectReasonError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirmReject}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw size={13} />
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
