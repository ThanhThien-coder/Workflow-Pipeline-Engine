import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { navigate } from '../../router/useRouter'
import { useProfileStore } from '../../store/useProfileStore'

interface GlobalProfileMenuProps {
  displayName?: string
  onLogout: () => void
  avatarInitials?: string
  avatarUrl?: string | null
  avatarClassName?: string
  email?: string
  roleLabel?: string
  showName?: boolean
  onAdminPortal?: () => void
}

export function GlobalProfileMenu({
  displayName: fallbackDisplayName = 'Alex Kim',
  onLogout,
  avatarInitials,
  avatarUrl,
  avatarClassName = 'bg-indigo-100 text-indigo-700',
  email,
  roleLabel,
  showName = false,
  onAdminPortal,
}: GlobalProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const profile = useProfileStore((state) => state.profile)
  const loadProfile = useProfileStore((state) => state.loadProfile)
  const displayName = profile?.displayName || fallbackDisplayName
  const currentAvatarUrl = profile ? profile.avatarUrl : avatarUrl
  const currentEmail = profile?.email || email
  const currentInitials = profile
    ? profile.displayName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : avatarInitials || fallbackDisplayName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!profile) {
      void loadProfile().catch((error: unknown) => {
        console.error('Failed to load profile for the header', error)
      })
    }
  }, [loadProfile, profile])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full p-1 transition hover:bg-slate-100"
        title={roleLabel ? `${displayName} (${roleLabel})` : displayName}
        aria-label="Open user menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt={displayName} className="h-9 w-9 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-2 ring-white shadow-xs select-none ${avatarClassName}`}>
            {currentInitials || '?'}
          </span>
        )}
        {showName && <span className="hidden text-xs font-semibold text-slate-800 sm:block">{displayName}</span>}
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <span className="block truncate text-xs font-semibold text-slate-800">{displayName}</span>
            {currentEmail && <span className="mt-0.5 block truncate text-[11px] text-slate-500">{currentEmail}</span>}
            {roleLabel && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{roleLabel}</span>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <UserRound className="h-4 w-4" />
            Profile
          </button>
          {onAdminPortal && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onAdminPortal()
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Admin Portal
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
