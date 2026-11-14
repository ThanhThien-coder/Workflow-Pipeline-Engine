import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Copy, Eye, Link, XCircle } from 'lucide-react'
import type { GuestAccessState } from '../../types/overview.types'
import { buildGuestUrl } from '../../utils/guestUrl'
import { useDismiss } from '../../hooks/useDismiss'

interface GuestAccessPopoverProps {
  state: GuestAccessState
  onRevoke: () => Promise<void>
  onGenerate: () => Promise<void>
  notify: (message: string) => void
  canManage?: boolean
}

export function GuestAccessPopover({ state, onRevoke, onGenerate, notify: _notify, canManage = true }: GuestAccessPopoverProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [buttonWidth, setButtonWidth] = useState(160)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, [wrapperRef])

  useLayoutEffect(() => {
    if (buttonRef.current) setButtonWidth(buttonRef.current.getBoundingClientRect().width)
  }, [state.isActive, open])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildGuestUrl(state.token))
    } catch {
      /* clipboard may be blocked */
    }
    setCopied(true)
  }

  return (
    <div ref={wrapperRef} className="relative z-[45] shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={!canManage ? 'Chỉ chủ dự án mới tạo được link khách' : undefined}
        className={`relative flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
          open
            ? 'border-slate-400 bg-slate-50 text-slate-800 ring-2 ring-slate-100'
            : state.isActive
              ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              : canManage
                ? 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
        }`}
      >
        <Link size={16} />
        {state.isActive ? 'Share Guest Link' : canManage ? 'Guest Link (Revoked)' : 'Guest Link (Owner only)'}
        {!state.isActive && canManage && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share Guest Access"
          className="pop-in absolute right-0 top-full z-50 mt-3 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ transformOrigin: `calc(100% - ${buttonWidth / 2}px) top` }}
        >
          <div
            className="absolute -top-2 h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white"
            style={{ right: Math.max(buttonWidth / 2 - 8, 16) }}
          />
          {state.isActive ? (
            <div className="fade-up space-y-4 px-5 py-4">
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                🟢 Access Active
              </span>
              <div className="flex gap-2">
                <div
                  title={buildGuestUrl(state.token)}
                  className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600 select-all"
                >
                  {buildGuestUrl(state.token)}
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className={`flex shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-semibold ${
                    copied
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <ul className="space-y-1 text-xs text-slate-500">
                <li>
                  <Eye size={13} className="mr-1 inline" />
                  Permissions: View-only &amp; submit Feedback
                </li>
                <li>Expires: {state.expiresLabel}</li>
                <li className="font-mono text-[11px]">token: {state.token}</li>
              </ul>
              <button
                type="button"
                disabled={!canManage}
                title={!canManage ? 'Chỉ chủ dự án mới thu hồi được link khách' : undefined}
                onClick={() => {
                  setCopied(false)
                  void onRevoke()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-white py-2 text-xs font-semibold text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <XCircle size={14} />
                Revoke Guest Access (Deactivate Token)
              </button>
              {!canManage && (
                <p data-testid="guest-owner-only-note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Chỉ chủ dự án mới tạo hoặc thu hồi được link khách.
                </p>
              )}
            </div>
          ) : (
            <div className="fade-up space-y-4 px-5 py-4">
              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                🔴 {canManage ? 'Link Revoked' : 'Owner Only'}
              </span>
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                {canManage
                  ? 'External guests can no longer access this project using previous links.'
                  : state.expiresLabel || 'Chỉ chủ dự án mới có quyền quản lý link khách.'}
              </p>
              <button
                type="button"
                disabled={!canManage}
                title={!canManage ? 'Chỉ chủ dự án mới tạo được link khách' : undefined}
                onClick={() => void onGenerate()}
                className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200"
              >
                Generate New Token
              </button>
              {!canManage && (
                <p data-testid="guest-owner-only-note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Chỉ chủ dự án mới tạo được link khách.
                </p>
              )}
            </div>
          )}
          <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
            Time-limited tokens can be instantly revoked and only expose public project resources.
          </div>
        </div>
      )}
    </div>
  )
}
