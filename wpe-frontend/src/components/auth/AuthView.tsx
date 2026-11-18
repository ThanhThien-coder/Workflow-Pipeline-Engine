import { useState, useEffect, type FC, type FormEvent } from 'react'
import { Logo } from '../common/Logo'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { isApiError } from '../../services/http/ApiError'
import { getAuthErrorMessage } from '../../services/impl/http/auth'
import { homePathFor } from '../../router/adminGuard'
import { EyeIcon, Spinner, Showcase, Field, inputCls } from './authShared'
import { ForgotPasswordPanel } from './ForgotPasswordPanel'

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

export const AuthView: FC = () => {
  const { searchParams, navigate } = useRouter()
  const urlTabInit = searchParams.get('tab')
  const initialTab = urlTabInit === 'signup' ? 'signup' : urlTabInit === 'forgot' ? 'forgot' : 'signin'

  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>(initialTab)
  const [f, setF] = useState({ name: '', email: '', pw: '' })
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
    } else if (urlTab === 'forgot' && tab !== 'forgot') {
      setTab('forgot')
      setErr({})
    }
  }, [searchParams, tab])

  const handleTabChange = (newTab: 'signin' | 'signup' | 'forgot') => {
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
    // G22: đăng nhập và đăng ký đều bằng email (username có thể trùng)
    if (!f.email.trim()) {
      e.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
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
        const signedIn = useWorkflowStore.getState().auth.currentUser
        const who = signedIn?.name?.trim() || signedIn?.username || f.email.trim()
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
            {tab === 'forgot' ? (
              <ForgotPasswordPanel
                initialEmail={f.email}
                onBack={() => handleTabChange('signin')}
              />
            ) : (
            <>
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
                label={signup ? 'Work email' : 'Email'}
                error={err.email}
              >
                <input
                  type="email"
                  className={inputCls(err.email)}
                  placeholder="alex.kim@pipeline.engine"
                  value={f.email}
                  onChange={setField('email')}
                  autoComplete="email"
                />
              </Field>

              <Field
                label="Password"
                error={err.pw}
                right={
                  !signup && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('forgot')}
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
            </>
            )}
          </div>
        </main>
      </div>

      <Showcase />
    </div>
  )
}
