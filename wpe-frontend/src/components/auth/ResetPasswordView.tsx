import { useEffect, useState, type FC, type FormEvent } from 'react'
import { Logo } from '../common/Logo'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { isApiError } from '../../services/http/ApiError'
import {
  getAuthErrorMessage,
  resetPassword,
  verifyPasswordResetToken,
} from '../../services/impl/http/auth'
import { EyeIcon, Field, Showcase, Spinner, inputCls } from './authShared'

const AUTOCOMPLETE_NEW_PW = 'new-password'

type Phase = 'verifying' | 'invalid' | 'form' | 'done'

/** Chính sách mật khẩu của backend: ≥ 8 ký tự, ≥ 1 chữ số, ≤ 72 byte UTF-8. */
export function validateNewPassword(pw: string): string | null {
  if (pw.length < 8 || !/\d/.test(pw)) return 'Use at least 8 characters, including a number.'
  if (new TextEncoder().encode(pw).length > 72) return 'Password is too long (72 bytes maximum).'
  return null
}

/** Đọc token từ `#token=...` (nếu có). */
function readTokenFromHash(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.replace(/^#/, '')
  return new URLSearchParams(hash).get('token')?.trim() ?? ''
}

export const ResetPasswordView: FC = () => {
  const { navigate } = useRouter()
  const endSessionLocally = useWorkflowStore((state) => state.auth.endSessionLocally)

  // Token chỉ đọc một lần khi mở trang, rồi xóa khỏi thanh địa chỉ.
  const [token] = useState(readTokenFromHash)
  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'invalid')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', '/reset-password')
    }
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    verifyPasswordResetToken(token)
      .then(() => {
        if (!cancelled) setPhase('form')
      })
      .catch((e) => {
        if (cancelled) return
        if (isApiError(e) && e.code !== 'INVALID_RESET_TOKEN' && e.code !== 'VALIDATION_FAILED') {
          // Lỗi mạng/máy chủ: cho nhập tiếp, lúc gửi sẽ báo lại nếu vẫn lỗi.
          setFormError(getAuthErrorMessage(e, 'Could not verify the reset link.'))
          setPhase('form')
        } else {
          setPhase('invalid')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const next: { pw?: string; confirm?: string } = {}
    const pwError = validateNewPassword(pw)
    if (pwError) next.pw = pwError
    else if (pw !== confirm) next.confirm = "Passwords don't match."
    setErrors(next)
    setFormError(null)
    if (next.pw || next.confirm) return

    setBusy(true)
    try {
      await resetPassword(token, pw)
      // Backend đã thu hồi mọi phiên: dọn phiên trên máy này nếu đang đăng nhập.
      if (useWorkflowStore.getState().auth.isAuthenticated) endSessionLocally()
      setPhase('done')
    } catch (e) {
      if (isApiError(e) && e.code === 'INVALID_RESET_TOKEN') {
        setPhase('invalid')
      } else if (isApiError(e) && e.code === 'WEAK_PASSWORD') {
        setErrors({ pw: e.message || 'This password is too weak.' })
      } else {
        setFormError(getAuthErrorMessage(e, 'Could not update your password. Please try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const primaryBtn =
    'btn-primary-solid w-full flex items-center justify-center gap-2 text-sm font-semibold text-white py-2.5 rounded-xl shadow-md disabled:opacity-70 cursor-pointer'

  const eyeButton = (
    <button
      type="button"
      aria-label={show ? 'Hide password' : 'Show password'}
      onClick={() => setShow(!show)}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 transition-colors"
    >
      <EyeIcon off={show} />
    </button>
  )

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
            {phase === 'verifying' && (
              <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
                Checking your reset link…
              </div>
            )}

            {phase === 'invalid' && (
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Link not valid</h1>
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700"
                >
                  This password reset link is invalid or has expired.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auth?tab=forgot')}
                  className={`${primaryBtn} mt-5`}
                >
                  Request a new link
                </button>
              </div>
            )}

            {phase === 'form' && (
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Choose a new password</h1>
                <p className="mt-1.5 text-sm text-slate-500">At least 8 characters, including a number.</p>

                <form onSubmit={submit} noValidate className="mt-5 space-y-4">
                  <Field label="New password" error={errors.pw}>
                    <div className="relative">
                      <input
                        type={show ? 'text' : 'password'}
                        className={`${inputCls(errors.pw)} pr-11`}
                        placeholder="Enter a new password"
                        value={pw}
                        onChange={(e) => {
                          setPw(e.target.value)
                          if (errors.pw) setErrors((p) => ({ ...p, pw: null }))
                        }}
                        autoComplete={AUTOCOMPLETE_NEW_PW}
                      />
                      {eyeButton}
                    </div>
                  </Field>

                  <Field label="Confirm new password" error={errors.confirm}>
                    <input
                      type={show ? 'text' : 'password'}
                      className={inputCls(errors.confirm)}
                      placeholder="Repeat the new password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value)
                        if (errors.confirm) setErrors((p) => ({ ...p, confirm: null }))
                      }}
                      autoComplete={AUTOCOMPLETE_NEW_PW}
                    />
                  </Field>

                  {formError && <p className="text-[11px] font-medium text-rose-600 fade">{formError}</p>}

                  <button type="submit" disabled={busy} className={primaryBtn}>
                    {busy ? (
                      <>
                        <Spinner />
                        Updating…
                      </>
                    ) : (
                      'Update password'
                    )}
                  </button>
                </form>
              </div>
            )}

            {phase === 'done' && (
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  Your password has been updated
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">All other sessions have been signed out.</p>
                <button
                  type="button"
                  onClick={() => navigate('/auth?tab=signin')}
                  className={`${primaryBtn} mt-6`}
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Showcase />
    </div>
  )
}
