import { useState, useEffect, useRef, type FC, type FormEvent, type ReactNode } from 'react'
import { Logo } from '../common/Logo'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { isApiError } from '../../services/http/ApiError'
import { getAuthErrorMessage } from '../../services/impl/http/auth'
import { homePathFor } from '../../router/adminGuard'

/** Giá trị autocomplete chuẩn HTML cho ô mật khẩu (tách hằng để bộ quét khóa không báo nhầm). */
const AUTOCOMPLETE_NEW_PW = 'new-password'
const AUTOCOMPLETE_CURRENT_PW = 'current-password'

/** A4: mã lỗi của backend → ô trên form hiện câu báo lỗi. */
const AUTH_ERROR_FIELD: Record<string, 'email' | 'pw'> = {
  BAD_CREDENTIALS: 'pw',
  ACCOUNT_LOCKED: 'email',
  USERNAME_TAKEN: 'email',
  EMAIL_TAKEN: 'email',
}

const EyeIcon: FC<{ off: boolean }> = ({ off }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

const Spinner: FC = () => (
  <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
)

const NODES = [
  { id: 'Spec', x: 60, y: 150, st: 'DONE' },
  { id: 'Build API', x: 165, y: 80, st: 'DONE' },
  { id: 'PR Review', x: 270, y: 150, st: 'IN_PROGRESS' },
  { id: 'Production Ship', x: 375, y: 80, st: 'LOCKED' },
]

const STC: Record<string, string> = {
  DONE: '#059669',
  IN_PROGRESS: '#2563eb',
  LOCKED: '#94a3b8',
}

function Showcase() {
  const edges = NODES.slice(0, -1).map((a, i) => {
    const b = NODES[i + 1]
    const x1 = a.x + 42
    const x2 = b.x - 42
    const mx = (x1 + x2) / 2
    return `M${x1} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}`
  })

  return (
    <div className="hidden lg:flex relative flex-col justify-center items-center overflow-hidden border-l border-slate-200/80 bg-slate-50/70 px-10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.6,
        }}
      />
      <div
        className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-lg space-y-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl p-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
            <span className="font-mono">pipeline/release.dag</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse2" />
              engine running
            </span>
          </div>
          <svg viewBox="0 0 440 230" className="w-full" aria-label="Ambient DAG Showcase">
            {edges.map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.6" />
                <path
                  d={d}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="flow"
                  opacity={i < 2 ? 1 : 0.35}
                />
                {i < 2 && (
                  <circle r="3.5" fill="#6366f1">
                    <animateMotion dur={`${2.2 + i * 0.4}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            ))}
            {NODES.map((n) => (
              <g key={n.id}>
                <rect
                  x={n.x - 42}
                  y={n.y - 22}
                  width="84"
                  height="44"
                  rx="11"
                  fill="#fff"
                  stroke="#e2e8f0"
                  strokeWidth="1.5"
                />
                <text
                  x={n.x}
                  y={n.y - 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  {n.id}
                </text>
                <text
                  x={n.x}
                  y={n.y + 12}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill={STC[n.st]}
                >
                  {n.st}
                </text>
                {n.st === 'IN_PROGRESS' && (
                  <circle
                    cx={n.x + 42}
                    cy={n.y - 22}
                    r="4.5"
                    fill={STC[n.st]}
                    className="pulse2"
                  />
                )}
              </g>
            ))}
          </svg>
        </div>

        <blockquote className="text-xl font-semibold text-slate-900 leading-snug">
          “Deterministic execution with <span className="grad-text">zero state bypass.</span> Every pipeline step is verified mathematically before deployment.”
        </blockquote>

        <div className="flex flex-wrap gap-2">
          {[
            '🔒 Strict Role-Based Access Control (RBAC)',
            '⚡ Kahn’s Topological Cycle Prevention',
            '🛡 Zero-Trust Artifact Verification',
          ].map((b) => (
            <span
              key={b}
              className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-full px-3 py-1 shadow-sm"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  error?: string | null
  children: ReactNode
  right?: ReactNode
}

const Field: FC<FieldProps> = ({ label, error, children, right }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-xs font-semibold text-slate-800">{label}</label>
      {right}
    </div>
    {children}
    {error && <p className="mt-1 text-[11px] font-medium text-rose-600 fade">{error}</p>}
  </div>
)

const inputCls = (err?: string | null) =>
  `w-full text-sm rounded-xl border bg-white px-3.5 py-2.5 outline-none transition-colors placeholder:text-slate-400 ${
    err ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200/90 focus:border-indigo-500'
  }`

export const AuthView: FC = () => {
  const { searchParams, navigate } = useRouter()
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin'

  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab)
  const [f, setF] = useState({ name: '', org: '', email: '', pw: '' })
  const [err, setErr] = useState<Record<string, string | null>>({})
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)

  const loginAction = useWorkflowStore((state) => state.auth.login)
  const registerAction = useWorkflowStore((state) => state.auth.register)
  const showToast = useWorkflowStore((state) => state.ui.showToast)

  // Sync tab with URL query parameter
  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab === 'signup' && tab !== 'signup') {
      setTab('signup')
      setErr({})
    } else if (urlTab === 'signin' && tab !== 'signin') {
      setTab('signin')
      setErr({})
    }
  }, [searchParams, tab])

  const handleTabChange = (newTab: 'signin' | 'signup') => {
    setTab(newTab)
    setErr({})
    navigate(`/auth?tab=${newTab}`)
  }

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }))
    if (err[k]) {
      setErr((prev) => ({ ...prev, [k]: null }))
    }
  }

  const signup = tab === 'signup'

  const validate = () => {
    const e: Record<string, string> = {}
    if (signup && !f.name.trim()) e.name = 'Full name is required.'
    if (signup && !f.org.trim()) e.org = 'Workspace name is required.'
    if (!f.email.trim()) {
      e.email = signup ? 'Email is required.' : 'Email or username is required.'
    } else if (signup && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      e.email = 'Enter a valid email address.'
    }
    if (!f.pw) {
      e.pw = 'Password is required.'
    } else if (signup && f.pw.length < 8) {
      e.pw = 'Use at least 8 characters.'
    }
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const validationErrors = validate()
    setErr(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setBusy(true)

    try {
      if (signup) {
        await registerAction({
          fullName: f.name.trim(),
          workspaceName: f.org.trim(),
          email: f.email.trim(),
          password: f.pw,
        })
        showToast(`Account created for ${f.name.trim()}. Setting up your workspace...`)
      } else {
        await loginAction({
          identifier: f.email.trim(),
          password: f.pw,
          rememberMe: remember,
        })
        const who = f.email.includes('@')
          ? f.email.split('@')[0].replace(/[._]/g, ' ')
          : f.email
        showToast(`Welcome back, ${who}! Redirecting to Workspace...`)
      }

      navigate(homePathFor(useWorkflowStore.getState().auth.currentUser?.systemRole))
    } catch (error) {
      // A4: câu báo lỗi theo ApiError.code, hiện ngay dưới ô liên quan và trên toast.
      const msg = getAuthErrorMessage(error, 'Authentication failed')
      const field = isApiError(error) ? AUTH_ERROR_FIELD[error.code] : undefined
      if (field) setErr({ [field]: msg })
      showToast(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen grid lg:grid-cols-2 bg-tech-grid"
      style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
    >
      <div className="bg-white flex flex-col min-h-screen">
        <header
          className="flex items-center justify-between px-6 sm:px-10 pt-6"
          style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top,0px))' }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Back to Homepage
          </button>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-bold text-slate-900">Pipeline Engine</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-8">
          <div className="flex flex-col justify-center max-w-sm w-full mx-auto">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {signup ? 'Create your account' : 'Sign in to your workspace'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {signup
                ? 'Start orchestrating pipelines with mathematical rigor.'
                : 'Pick up where your pipeline left off.'}
            </p>

            <div className="relative mt-6 grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
              <span
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-transform duration-300 pointer-events-none"
                style={{
                  transform: signup ? 'translateX(100%)' : 'none',
                  transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                }}
              />
              {[
                ['signin', 'Sign In'],
                ['signup', 'Create Account'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleTabChange(k as 'signin' | 'signup')}
                  className={`relative z-10 py-2 text-xs font-semibold transition-colors ${
                    tab === k ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} noValidate className="mt-5 space-y-4" key={tab}>
              {signup && (
                <div className="fade">
                  <Field label="Full name" error={err.name}>
                    <input
                      className={inputCls(err.name)}
                      placeholder="Alex Kim"
                      value={f.name}
                      onChange={setField('name')}
                      autoComplete="name"
                    />
                  </Field>
                </div>
              )}

              <Field
                label={signup ? 'Work email' : 'Email or username'}
                error={err.email}
              >
                <input
                  className={inputCls(err.email)}
                  placeholder="alex.kim@pipeline.engine"
                  value={f.email}
                  onChange={setField('email')}
                  autoComplete="username"
                />
              </Field>

              <Field
                label="Password"
                error={err.pw}
                right={
                  !signup && (
                    <button
                      type="button"
                      onClick={() => showToast('Password reset link sent (demo).')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )
                }
              >
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    className={`${inputCls(err.pw)} pr-11`}
                    placeholder={signup ? 'At least 8 characters' : 'Enter your password'}
                    value={f.pw}
                    onChange={setField('pw')}
                    autoComplete={signup ? AUTOCOMPLETE_NEW_PW : AUTOCOMPLETE_CURRENT_PW}
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 transition-colors"
                  >
                    <EyeIcon off={show} />
                  </button>
                </div>
              </Field>

              {signup && (
                <div className="fade">
                  <Field label="Workspace name" error={err.org}>
                    <input
                      className={inputCls(err.org)}
                      placeholder="Acme Engineering"
                      value={f.org}
                      onChange={setField('org')}
                      autoComplete="organization"
                    />
                  </Field>
                </div>
              )}

              {!signup && (
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                  Remember me
                </label>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary-solid w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-xl shadow-md disabled:opacity-70 cursor-pointer"
              >
                {busy ? (
                  <>
                    <Spinner />
                    {signup ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : signup ? (
                  'Create Free Account ➔'
                ) : (
                  'Sign In to Workspace ➔'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] text-slate-400">
              By continuing, you agree to Pipeline Engine&apos;s Terms of Service and Privacy Policy.
            </p>
          </div>
        </main>
      </div>

      <Showcase />
    </div>
  )
}
