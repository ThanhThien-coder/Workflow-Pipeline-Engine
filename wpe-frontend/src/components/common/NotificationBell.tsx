import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { AlertCircle, Bell, CheckCheck, CheckCircle2, GitPullRequest, MessageSquare, Sparkles, UserPlus } from 'lucide-react'
import { navigate } from '../../router/useRouter'
import { useNotificationStore } from '../../store/useNotificationStore'
import type { NotificationDto, NotificationKind } from '../../types/notification.types'
import { getSavedAvatar } from '../../utils/avatarUtils'
import { ProjectInviteAcceptModal } from '../workspace/ProjectInviteAcceptModal'

const AVATAR_BG = ['bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-rose-500', 'bg-violet-500']
const KIND_ICON: Record<NotificationKind, { icon: typeof Bell; tone: string }> = {
  approval: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  comment: { icon: MessageSquare, tone: 'bg-blue-50 text-blue-600' },
  overdue: { icon: AlertCircle, tone: 'bg-red-50 text-red-600' },
  assignment: { icon: UserPlus, tone: 'bg-indigo-50 text-indigo-600' },
  pr: { icon: GitPullRequest, tone: 'bg-violet-50 text-violet-600' },
  system: { icon: Sparkles, tone: 'bg-slate-100 text-slate-600' },
  invitation: { icon: UserPlus, tone: 'bg-indigo-50 text-indigo-600' },
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

export function formatNotificationTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export function NotificationSender({ n }: { n: NotificationDto }) {
  // System events (no sender) or alerts get a kind icon; people get an initials avatar
  if (!n.actorName || n.kind === 'overdue') {
    const { icon: Icon, tone } = KIND_ICON[n.kind]
    return <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)}><Icon size={17} /></span>
  }
  const savedAvatar = getSavedAvatar(n.actorName)
  if (savedAvatar) {
    return (
      <img
        src={savedAvatar}
        alt={n.actorName}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    )
  }
  return <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white', AVATAR_BG[hash(n.actorName) % AVATAR_BG.length])}>{initials(n.actorName)}</span>
}

export default function NotificationBell() {
  const { items, unreadCount, loading, error, load, markRead, markAllRead } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Deep-link interception from URL search params (e.g. /workspace?action=open-invite-modal&invitationId={id})
  useEffect(() => {
    const checkInviteDeepLink = () => {
      if (typeof window === 'undefined') return
      const search = window.location.search
      if (search.includes('action=open-invite-modal')) {
        const params = new URLSearchParams(search)
        const id = params.get('invitationId')
        if (id) {
          setActiveInviteId(id)
          setIsInviteModalOpen(true)
        }
      }
    }

    checkInviteDeepLink()
    window.addEventListener('popstate', checkInviteDeepLink)
    window.addEventListener('wpe_route_change', checkInviteDeepLink)
    return () => {
      window.removeEventListener('popstate', checkInviteDeepLink)
      window.removeEventListener('wpe_route_change', checkInviteDeepLink)
    }
  }, [])

  // Initial load + light polling so the badge stays fresh
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 60000)
    return () => clearInterval(t)
  }, [load])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = () => {
    if (!open) void load()
    setOpen(!open)
  }

  // Row click = 3 actions at once: close popover, mark as read, navigate (or open modal if invite link)
  const pick = (n: NotificationDto) => {
    setOpen(false)
    void markRead(n.id)

    const path = n.targetPath || ''
    if (path.includes('action=open-invite-modal')) {
      const match = path.match(/invitationId=([^&]+)/)
      if (match && match[1]) {
        setActiveInviteId(match[1])
        setIsInviteModalOpen(true)
        return
      }
    }

    navigate(path)
  }

  return (
    <div ref={rootRef} className="relative">
      <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className={clsx('relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600', open && 'bg-slate-100 text-indigo-600')}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="pop absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-1rem)] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
            <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline disabled:cursor-default disabled:text-slate-400 disabled:no-underline">
              <CheckCheck size={14} /> Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><div className="h-9 w-9 rounded-full bg-slate-100" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-4/5 rounded bg-slate-100" /><div className="h-2.5 w-1/4 rounded bg-slate-100" /></div></div>)}
              </div>
            )}
            {!loading && error && items.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">Could not load notifications. <button type="button" onClick={() => void load()} className="font-semibold text-indigo-600 hover:underline">Retry</button></div>
            )}
            {!loading && !error && items.length === 0 && <div className="p-8 text-center text-sm text-slate-500">You are all caught up.</div>}
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => pick(n)}
                    className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors', n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/70 hover:bg-indigo-50')}>
                    <NotificationSender n={n} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-600">
                        {n.actorName && n.kind !== 'overdue' && <b className="font-semibold text-slate-900">{n.actorName} </b>}{n.text}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatNotificationTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-slate-100 p-2">
            <button type="button" onClick={() => { setOpen(false); navigate('/notifications') }}
              className="w-full rounded-lg py-2 text-center text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
              View all notifications
            </button>
          </div>
        </div>
      )}

      {/* Project Invitation Acceptance Modal via Deep-Link */}
      <ProjectInviteAcceptModal
        isOpen={isInviteModalOpen}
        invitationId={activeInviteId}
        onClose={() => {
          setIsInviteModalOpen(false)
          setActiveInviteId(null)
        }}
      />
    </div>
  )
}
