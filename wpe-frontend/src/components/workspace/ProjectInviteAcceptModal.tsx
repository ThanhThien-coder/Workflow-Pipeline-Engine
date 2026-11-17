import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { workflowService } from '../../services'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { ProjectInvitationDto } from '../../types/settings.types'

interface ProjectInviteAcceptModalProps {
  invitationId: string | null
  isOpen: boolean
  onClose: () => void
  onAccepted?: (invitationId: string) => void
  onDeclined?: (invitationId: string) => void
}

export function ProjectInviteAcceptModal({
  invitationId,
  isOpen,
  onClose,
  onAccepted,
  onDeclined,
}: ProjectInviteAcceptModalProps) {
  const [invitation, setInvitation] = useState<ProjectInvitationDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isExpired = invitation
    ? invitation.status !== 'PENDING' ||
      (Boolean(invitation.expiresAt) && new Date(invitation.expiresAt).getTime() <= Date.now())
    : false

  const getExpiredStatusLabel = () => {
    if (!invitation) return 'This invitation has expired'
    if (invitation.status === 'ACCEPTED') return 'This invitation has been accepted'
    if (invitation.status === 'REJECTED') return 'This invitation has been declined'
    if (invitation.status === 'REVOKED') return 'This invitation has been revoked'
    if (invitation.status === 'EXPIRED') return 'This invitation has expired'
    return 'This invitation has expired'
  }

  const extractErrorMessage = (err: unknown, defaultMsg: string): string => {
    if (!err) return defaultMsg
    const anyErr = err as any
    const errCode = anyErr?.code || anyErr?.response?.data?.error || anyErr?.error || anyErr?.errorCode
    const rawMsg = typeof anyErr?.message === 'string' && anyErr.message ? anyErr.message : ''
    if (errCode === 'INVITATION_EXPIRED' || rawMsg.includes('INVITATION_EXPIRED')) {
      return 'This invitation has expired.'
    }
    if (errCode === 'INVITATION_NOT_PENDING') {
      if (rawMsg.toUpperCase().includes('REVOKED')) {
        return 'This invitation has been revoked.'
      }
      return rawMsg || 'This invitation is no longer pending.'
    }
    return rawMsg || defaultMsg
  }

  const syncStatusFromError = (err: unknown) => {
    const anyErr = err as any
    const errCode = anyErr?.code || anyErr?.response?.data?.error || anyErr?.error || anyErr?.errorCode
    const rawMsg = typeof anyErr?.message === 'string' ? anyErr.message : ''
    if (errCode === 'INVITATION_EXPIRED' || rawMsg.includes('INVITATION_EXPIRED')) {
      setInvitation((prev) => (prev ? { ...prev, status: 'EXPIRED' } : prev))
    } else if (errCode === 'INVITATION_NOT_PENDING' && rawMsg.toUpperCase().includes('REVOKED')) {
      setInvitation((prev) => (prev ? { ...prev, status: 'REVOKED' } : prev))
    }
  }

  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const fetchProjects = useWorkflowStore((state) => state.workspace.fetchProjects)
  const acceptInvitationStore = useWorkflowStore((state) => state.settings.acceptInvitation)
  const rejectInvitationStore = useWorkflowStore((state) => state.settings.rejectInvitation)

  useEffect(() => {
    if (!isOpen || !invitationId) {
      setInvitation(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    const fetchDetail = async () => {
      try {
        let data: ProjectInvitationDto | null = null
        if (workflowService.getInvitationDetail) {
          data = await workflowService.getInvitationDetail(invitationId)
        } else if (workflowService.getInvitation) {
          data = await workflowService.getInvitation(invitationId)
        }
        if (isMounted) {
          if (data) {
            setInvitation(data)
          } else {
            setError('Invitation not found or it has expired.')
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = extractErrorMessage(err, 'Could not load the invitation.')
          setError(msg)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void fetchDetail()

    return () => {
      isMounted = false
    }
  }, [isOpen, invitationId])

  const handleAccept = async () => {
    if (!invitationId || isExpired) return
    setSubmitting('accept')
    setError(null)
    try {
      if (workflowService.acceptInvitation) {
        await workflowService.acceptInvitation(invitationId)
      } else if (acceptInvitationStore) {
        await acceptInvitationStore(invitationId)
      }
      showToast('You joined the project.')
      if (fetchProjects) {
        await fetchProjects()
      }
      void useNotificationStore.getState().load()
      onAccepted?.(invitationId)
      onClose()
    } catch (err: unknown) {
      syncStatusFromError(err)
      const msg = extractErrorMessage(err, 'Could not accept the invitation.')
      setError(msg)
      showToast(msg)
    } finally {
      setSubmitting(null)
    }
  }

  const handleDecline = async () => {
    if (!invitationId || isExpired) return
    setSubmitting('decline')
    setError(null)
    try {
      if (workflowService.rejectInvitation) {
        await workflowService.rejectInvitation(invitationId)
      } else if (rejectInvitationStore) {
        await rejectInvitationStore(invitationId)
      }
      showToast('Invitation declined.')
      void useNotificationStore.getState().load()
      onDeclined?.(invitationId)
      onClose()
    } catch (err: unknown) {
      syncStatusFromError(err)
      const msg = extractErrorMessage(err, 'Could not decline the invitation.')
      setError(msg)
      showToast(msg)
    } finally {
      setSubmitting(null)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl shadow-indigo-950/20"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-4 ring-indigo-50/50">
              <Mail size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Project invitation</h2>
              <p className="text-xs text-slate-500">
                You have been invited to build and run a workflow on Workflow Pipeline Engine.
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="my-5 space-y-4">
            {/* Skeleton Loader */}
            {loading && (
              <div data-testid="invitation-skeleton" className="space-y-4 animate-pulse">
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-16 bg-slate-200 rounded"></div>
                    <div className="h-4 w-40 bg-slate-200 rounded"></div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                    <div className="space-y-1.5 flex flex-col items-end">
                      <div className="h-3.5 w-28 bg-slate-200 rounded"></div>
                      <div className="h-2.5 w-36 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <div className="h-3 w-24 bg-slate-200 rounded"></div>
                    <div className="h-5 w-24 bg-indigo-100 rounded-full"></div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <div className="h-3 w-16 bg-slate-200 rounded"></div>
                    <div className="h-3 w-32 bg-slate-200 rounded"></div>
                  </div>
                </div>
                <div className="h-3 w-5/6 bg-slate-200 rounded mx-auto"></div>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-700">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {!loading && invitation && (
              <div className="space-y-4">
                {isExpired && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                    <span>{getExpiredStatusLabel()}</span>
                  </div>
                )}

                {/* Details Box */}
                <div
                  className={`rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3 transition-opacity ${
                    isExpired ? 'opacity-60 grayscale' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Project</span>
                    <span className="text-sm font-bold text-slate-800">
                      {invitation.projectName || 'Pipeline Project'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-medium text-slate-500">Invited by</span>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-700">
                        {invitation.inviterName || 'Project owner'}
                      </div>
                      {invitation.inviterEmail && (
                        <div className="text-[11px] text-slate-400">{invitation.inviterEmail}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-medium text-slate-500">Assigned role</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      <ShieldCheck size={13} />
                      {invitation.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      Respond by
                    </span>
                    <span className="font-medium text-slate-600">
                      {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] leading-relaxed text-slate-500">
                  After accepting, you can open the workflow DAG, move tasks through their statuses
                  and submit work for review as <b>{invitation.role}</b>.
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {!loading && invitation && (
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleDecline}
                disabled={submitting !== null || isExpired}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting === 'decline' ? (
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                ) : (
                  <UserX size={14} />
                )}
                <span>Decline</span>
              </button>

              <button
                type="button"
                onClick={handleAccept}
                disabled={submitting !== null || isExpired}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting === 'accept' ? (
                  <Loader2 size={14} className="animate-spin text-white" />
                ) : (
                  <UserCheck size={14} />
                )}
                <span>Accept</span>
              </button>
            </div>
          )}

          {/* Close-only footer if error occurred and no invitation */}
          {!loading && error && !invitation && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
