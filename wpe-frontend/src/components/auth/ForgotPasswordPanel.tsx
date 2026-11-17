import { useEffect, useState, type FC, type FormEvent } from 'react'
import { isApiError } from '../../services/http/ApiError'
import {
  getAuthErrorMessage,
  getPasswordResetStatus,
  requestPasswordReset,
} from '../../services/impl/http/auth'
import { Field, Spinner, inputCls } from './authShared'

export const RESET_UNAVAILABLE_MESSAGE =
  "Password reset by email isn't available right now. Please contact your workspace administrator."

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ForgotPasswordPanelProps {
  /** Email đang gõ ở màn đăng nhập (nếu có). */
  initialEmail?: string
  onBack: () => void
}

/** Màn "Reset your password" trong AuthView (?tab=forgot). */
export const ForgotPasswordPanel: FC<ForgotPasswordPanelProps> = ({ initialEmail = '', onBack }) => {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPasswordResetStatus()
      .then((status) => {
        if (!cancelled && status.enabled === false) setUnavailable(true)
      })
      .catch((e) => {
        if (!cancelled) setError(getAuthErrorMessage(e, 'Could not check password reset availability.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const send = async () => {
    const value = email.trim()
    if (!value) {
      setError('Email is required.')
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(value)
      setSent(true)
    } catch (e) {
      if (isApiError(e) && e.code === 'PASSWORD_RESET_UNAVAILABLE') {
        setUnavailable(true)
      } else {
        setError(getAuthErrorMessage(e, 'Could not send the reset link. Please try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    void send()
  }

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
    >
      Back to sign in
    </button>
  )

  if (unavailable) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reset your password</h1>
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-medium text-amber-800"
        >
          {RESET_UNAVAILABLE_MESSAGE}
        </p>
        <div className="mt-5 text-center">{backButton}</div>
      </div>
    )
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Check your inbox</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          If an account exists for {email.trim()}, we&apos;ve sent a password reset link. It expires in 30 minutes.
          Don&apos;t forget to check your spam folder.
        </p>
        {error && <p className="mt-3 text-[11px] font-medium text-rose-600 fade">{error}</p>}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="btn-primary-solid w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-xl shadow-md cursor-pointer"
          >
            Back to sign in
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 py-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 disabled:opacity-70 cursor-pointer"
          >
            {busy ? 'Sending…' : 'Send again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Enter the email you use to sign in and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <Field label="Email" error={error}>
          <input
            type="email"
            className={inputCls(error)}
            placeholder="alex.kim@pipeline.engine"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            autoComplete="email"
          />
        </Field>

        <button
          type="submit"
          disabled={busy}
          className="btn-primary-solid w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-xl shadow-md disabled:opacity-70 cursor-pointer"
        >
          {busy ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      <div className="mt-5 text-center">{backButton}</div>
    </div>
  )
}
