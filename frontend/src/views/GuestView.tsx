import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, GitBranch, Send, Sparkles, UserRound } from 'lucide-react'
import { guestService } from '../services/container'
import { navigate, useRouter } from '../router/useRouter'
import { GuestLinkError } from '../types/guest.types'
import type {
  GuestAiSummaryDto,
  GuestFeedbackDto,
  GuestLinkErrorCode,
  GuestLinkInfoDto,
  GuestOverviewDto,
  GuestSessionDto,
  GuestStatusKey,
} from '../types/guest.types'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; code: GuestLinkErrorCode | 'UNKNOWN' }
  | { kind: 'entry'; info: GuestLinkInfoDto }
  | { kind: 'ready'; info: GuestLinkInfoDto; session: GuestSessionDto }

const storageKey = (token: string) => `wpe_guest_session:${token}`
const toCode = (e: unknown): GuestLinkErrorCode | 'UNKNOWN' => (e instanceof GuestLinkError ? e.code : 'UNKNOWN')

const STATUS_BAR: Record<GuestStatusKey, string> = {
  done: 'bg-emerald-500',
  inProgress: 'bg-blue-500',
  todo: 'bg-sky-400',
  blocked: 'bg-slate-300',
}
const AVATAR = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500']

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="fixed-ambient-bg" />
      <div className="relative z-10 h-screen overflow-y-auto">{children}</div>
    </>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <Sparkles size={18} />
      </div>
      <span className="text-sm font-bold text-slate-900">Pipeline Engine</span>
    </div>
  )
}

const ERROR_TEXT: Record<GuestLinkErrorCode | 'UNKNOWN', string> = {
  INVALID: 'This link is not valid.',
  EXPIRED: 'This link has expired.',
  REVOKED: 'The owner has revoked access to this link.',
  UNKNOWN: 'Something went wrong. Please try again later.',
}

function ErrorScreen({ code }: { code: GuestLinkErrorCode | 'UNKNOWN' }) {
  return (
    <Shell>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rise w-full max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 text-red-700" size={32} />
          <h1 className="text-lg font-bold text-slate-900">Link unavailable</h1>
          <p className="mt-1 text-sm text-slate-500">{ERROR_TEXT[code]}</p>
          <button onClick={() => navigate('/')} className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to home
          </button>
        </div>
      </div>
    </Shell>
  )
}

function EntryScreen({ info, onEnter }: { info: GuestLinkInfoDto; onEnter: (name: string | null) => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (value: string | null) => {
    setBusy(true)
    await onEnter(value)
    setBusy(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) void go(name.trim())
  }
  return (
    <Shell>
      <div className="flex min-h-screen items-center justify-center p-6">
        <form onSubmit={submit} className="rise w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <Logo />
          <h1 className="mt-6 text-xl font-bold text-slate-900">
            You are viewing <span className="grad-text">{info.projectName}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Shared by {info.ownerName}. Tell us who you are, or stay anonymous.</p>
          <label className="mt-6 block text-xs font-semibold text-slate-600">Your name</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-indigo-400">
            <UserRound size={16} className="text-slate-400" />
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Mr. Tran, OOAD lecturer" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          </div>
          <button type="submit" disabled={busy || !name.trim()} className="btn-primary-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Continue <ArrowRight size={16} />
          </button>
          <button type="button" disabled={busy} onClick={() => void go(null)} className="mt-2 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Continue as anonymous
          </button>
        </form>
      </div>
    </Shell>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e0e7ff" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-indigo-700">{pct}%</span>
    </div>
  )
}

function StatCard({ icon, tone, label, value, sub, right }: { icon: ReactNode; tone: string; label: string; value: number | string; sub: string; right?: ReactNode }) {
  return (
    <div className="animate-cascade-down rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', tone)}>{icon}</div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>
        {right}
      </div>
    </div>
  )
}

function Overview({ token, info, session, onError, onSwitch }: { token: string; info: GuestLinkInfoDto; session: GuestSessionDto; onError: (c: GuestLinkErrorCode | 'UNKNOWN') => void; onSwitch: () => void }) {
  const [data, setData] = useState<GuestOverviewDto | null>(null)
  const [ai, setAi] = useState<GuestAiSummaryDto | null>(null)
  const [feedback, setFeedback] = useState<GuestFeedbackDto[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    guestService.getOverview(token).then(setData).catch((e) => onError(toCode(e)))
    guestService.getAiSummary(token).then(setAi).catch(() => setAi(null))
  }, [token, onError])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      const item = await guestService.submitFeedback(token, { sessionId: session.sessionId, message: message.trim() })
      setFeedback((prev) => [{ ...item, author: session.displayName ?? 'Anonymous' }, ...prev])
      setMessage('')
    } catch (err) {
      onError(toCode(err))
    } finally {
      setSending(false)
    }
  }

  const peak = data ? Math.max(...data.velocity.map((v) => v.value)) : 1

  return (
    <Shell>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Eye size={13} /> Guest view · {session.displayName ?? 'Anonymous'}
          </span>
          <button type="button" onClick={onSwitch} className="text-xs font-medium text-slate-500 hover:text-indigo-600">
            Change identity
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 pb-20">
        <div className="fade">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{info.projectName}</h1>
            {data && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{data.phaseLabel}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Shared by {info.ownerName}{data && ` · Last updated ${data.lastUpdated}`}</p>
        </div>

        <section className="rise rounded-2xl border border-indigo-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className={clsx('text-indigo-600', !ai && 'pulse2')} />
            <h2 className="grad-text text-sm font-bold">AI Summary</h2>
          </div>
          {!ai ? (
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <p>{ai.content}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ul className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {ai.highlights.map((h) => <li key={h}>✓ {h}</li>)}
                </ul>
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {ai.risks.map((r) => <li key={r}>! {r}</li>)}
                </ul>
              </div>
            </div>
          )}
        </section>

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<GitBranch size={18} />} tone="bg-indigo-50 text-indigo-600" label="Total Nodes" value={data.totalNodes} sub={`${data.criticalNodes} nodes on critical path`} />
              <StatCard icon={<CheckCircle2 size={18} />} tone="bg-emerald-50 text-emerald-600" label="Completion" value={`${data.completionPct}%`} sub={`${data.completedNodes} / ${data.totalNodes} nodes completed`} right={<Ring pct={data.completionPct} />} />
              <StatCard icon={<AlertCircle size={18} />} tone="bg-red-50 text-red-600" label="Overdue" value={data.overdueCount} sub={`${data.blockingCount} blocking release`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <section className="rise rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="text-sm font-bold text-slate-900">Weekly Velocity</h2>
                  <div className="mt-4 flex h-44 items-end gap-3">
                    {data.velocity.map((v) => (
                      <div key={v.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <div className={clsx('bar animate-bar w-full max-w-[40px] rounded-t-md', v.value === peak ? 'bg-emerald-500' : 'bg-indigo-300')} style={{ height: `${(v.value / peak) * 100}%` }} title={`${v.value} tasks`} />
                        <span className="text-[11px] text-slate-500">{v.day}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rise rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Task Status Breakdown</h2>
                    <span className="text-xs text-slate-500">Total {data.totalTasks} tasks</span>
                  </div>
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                    {data.statusBreakdown.map((s) => <div key={s.key} className={STATUS_BAR[s.key]} style={{ width: `${(s.count / data.totalTasks) * 100}%` }} />)}
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.statusBreakdown.map((s) => {
                      const pct = Math.round((s.count / data.totalTasks) * 100)
                      return (
                        <div key={s.key}>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2 text-slate-700"><span className={clsx('h-2 w-2 rounded-full', STATUS_BAR[s.key])} />{s.label}</span>
                            <span className="text-xs text-slate-500"><b className="text-slate-800">{pct}%</b> · {s.count} / {data.totalTasks} tasks</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={clsx('h-full rounded-full', STATUS_BAR[s.key])} style={{ width: `${pct}%` }} /></div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rise rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-bold text-slate-900">Send Feedback</h2>
                  <form onSubmit={send} className="mt-3">
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} placeholder="Your comments on this project..." className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-400" />
                    <button type="submit" disabled={sending || !message.trim()} className="btn-primary-solid mt-2 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      <Send size={13} /> Submit
                    </button>
                  </form>
                  {feedback.map((f) => (
                    <div key={f.id} className="pop mt-3 rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="text-xs font-semibold text-slate-800">{f.author}</div>
                      <p className="mt-1 text-slate-600">{f.message}</p>
                    </div>
                  ))}
                </section>

                <section className="rise rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
                  <div className="mt-3 space-y-3">
                    {data.recentActivity.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', AVATAR[i % AVATAR.length])}>{a.initials}</div>
                        <p className="clamp1 flex-1 text-sm text-slate-700"><b>{a.actor}</b> {a.text}</p>
                        <span className="text-[11px] text-slate-400">{a.ago}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </Shell>
  )
}

export function GuestView() {
  const { searchParams } = useRouter()
  const token = searchParams.get('token') ?? ''
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    if (!token) {
      setPhase({ kind: 'error', code: 'INVALID' })
      return
    }
    let alive = true
    guestService
      .getLinkInfo(token)
      .then((info) => {
        if (!alive) return
        let session: GuestSessionDto | null = null
        try {
          session = JSON.parse(localStorage.getItem(storageKey(token)) ?? 'null') as GuestSessionDto | null
        } catch {
          session = null
        }
        setPhase(session ? { kind: 'ready', info, session } : { kind: 'entry', info })
      })
      .catch((e) => alive && setPhase({ kind: 'error', code: toCode(e) }))
    return () => { alive = false }
  }, [token])

  const enter = async (name: string | null) => {
    if (phase.kind !== 'entry') return
    try {
      const session = await guestService.createSession(token, name)
      localStorage.setItem(storageKey(token), JSON.stringify(session))
      setPhase({ kind: 'ready', info: phase.info, session })
    } catch (e) {
      setPhase({ kind: 'error', code: toCode(e) })
    }
  }

  const change = () => {
    if (phase.kind !== 'ready') return
    localStorage.removeItem(storageKey(token))
    setPhase({ kind: 'entry', info: phase.info })
  }

  const fail = useCallback((code: GuestLinkErrorCode | 'UNKNOWN') => setPhase({ kind: 'error', code }), [])

  if (phase.kind === 'loading') {
    return <Shell><div className="flex min-h-screen items-center justify-center"><Sparkles className="pulse2 text-indigo-600" /></div></Shell>
  }
  if (phase.kind === 'error') return <ErrorScreen code={phase.code} />
  if (phase.kind === 'entry') return <EntryScreen info={phase.info} onEnter={enter} />
  return <Overview token={token} info={phase.info} session={phase.session} onError={fail} onSwitch={change} />
}

export default GuestView
