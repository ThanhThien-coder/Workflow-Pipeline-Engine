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
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const acceptInvitationStore = useWorkflowStore((state) => state.settings.acceptInvitation)
  const rejectInvitationStore = useWorkflowStore((state) => state.settings.rejectInvitation)

  useEffect(() => {
    if (!isOpen || !invitationId) {
      setInvitation(null)
      setError(null)
      setSuccessMessage(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    const fetchDetail = async () => {
      try {
        if (workflowService.getInvitation) {
          const data = await workflowService.getInvitation(invitationId)
          if (isMounted) setInvitation(data)
        } else {
          // Fallback mock detail
          if (isMounted) {
            setInvitation({
              id: invitationId,
              projectId: '1',
              projectName: 'Workflow Pipeline Alpha',
              inviterId: 'usr-1',
              inviterName: 'Lead Architect',
              inviterEmail: 'architect@pipeline.org',
              inviteeEmail: 'current_user@pipeline.org',
              role: 'COLLABORATOR',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            })
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Unable to load invitation details'
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
    if (!invitationId) return
    setActionLoading('accept')
    setError(null)
    try {
      let ok = false
      if (acceptInvitationStore) {
        ok = await acceptInvitationStore(invitationId)
      } else if (workflowService.acceptInvitation) {
        await workflowService.acceptInvitation(invitationId)
        ok = true
      }
      if (ok) {
        setSuccessMessage('Invitation accepted! Welcome to the workspace.')
        onAccepted?.(invitationId)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setError('Failed to accept invitation. It may have expired or been revoked.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation.'
      setError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async () => {
    if (!invitationId) return
    setActionLoading('decline')
    setError(null)
    try {
      let ok = false
      if (rejectInvitationStore) {
        ok = await rejectInvitationStore(invitationId)
      } else if (workflowService.rejectInvitation) {
        await workflowService.rejectInvitation(invitationId)
        ok = true
      }
      if (ok) {
        setSuccessMessage('Invitation declined.')
        onDeclined?.(invitationId)
        setTimeout(() => {
          onClose()
        }, 1000)
      } else {
        setError('Failed to decline invitation.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invitation.'
      setError(msg)
    } finally {
      setActionLoading(null)
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
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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
              <h2 className="text-base font-bold text-slate-900">Project Collaboration Invite</h2>
              <p className="text-xs text-slate-500">
                You have been invited to join a collaborative pipeline workspace.
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="my-5 space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-slate-500">
                <Loader2 size={28} className="animate-spin text-indigo-600 mb-2" />
                <span>Loading invitation details...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-700">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-800">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1 font-semibold">{successMessage}</div>
              </div>
            )}

            {!loading && invitation && !successMessage && (
              <div className="space-y-4">
                {/* Details Box */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Project</span>
                    <span className="text-sm font-bold text-slate-800">
                      {invitation.projectName || 'Pipeline Project'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-medium text-slate-500">Invited By</span>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-700">
                        {invitation.inviterName || 'Workspace Owner'}
                      </div>
                      {invitation.inviterEmail && (
                        <div className="text-[11px] text-slate-400">{invitation.inviterEmail}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-medium text-slate-500">Assigned Role</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      <ShieldCheck size={13} />
                      {invitation.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      Expires
                    </span>
                    <span className="font-medium text-slate-600">
                      {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
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
                  Accepting this invitation will grant you access to pipeline DAG execution,
                  task transitions, and artifacts in accordance with the <b>{invitation.role}</b> permissions.
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {!loading && invitation && !successMessage && (
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleDecline}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                {actionLoading === 'decline' ? (
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                ) : (
                  <UserX size={14} />
                )}
                <span>Decline</span>
              </button>

              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading === 'accept' ? (
                  <Loader2 size={14} className="animate-spin text-white" />
                ) : (
                  <UserCheck size={14} />
                )}
                <span>Accept Invitation</span>
              </button>
            </div>
          )}

          {/* Close-only footer if finished or failed */}
          {(successMessage || (error && !invitation)) && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
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
