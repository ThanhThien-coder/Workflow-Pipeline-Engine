import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Send } from 'lucide-react'
import type { GuestReportModel } from '../../../domain/guestReport'
import { submitGuestFeedback } from '../../../services/impl/http/guest'
import { Card, STATUS_CHIP, Sub } from '../ui'
import { phaseLabel } from './helpers'

export interface FeedbackSectionProps {
  token: string
  model: GuestReportModel
  scope: string
  onScopeChange: (scope: string) => void
  focusKey: number
}

export function FeedbackSection({ token, model, scope, onScopeChange, focusKey }: FeedbackSectionProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'TEACHER' | 'GUEST'>('TEACHER')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [sentCount, setSentCount] = useState(0)

  const formRef = useRef<HTMLFormElement | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setSentCount(0)
  }, [model, token])

  useEffect(() => {
    if (!focusKey) return
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    const timer = window.setTimeout(() => {
      areaRef.current?.focus({ preventScroll: true })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [focusKey])

  const isPhase = scope.startsWith('p:')
  const isTask = scope.startsWith('t:')
  const selectedPhase = isPhase ? model.phases.find((p) => p.id === scope.slice(2)) ?? null : null
  const selectedTask = isTask ? model.byId[scope.slice(2)] ?? null : null
  const phasePrefix = selectedPhase ? `[${phaseLabel(selectedPhase)}] ` : ''
  const maxMsgLength = Math.max(1, 2000 - phasePrefix.length)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setOk(false)
    if (!name.trim()) {
      setErr('Please enter your name so the team knows who wrote this.')
      return
    }
    if (!msg.trim()) return

    const trimmedMsg = msg.trim()
    const content = selectedPhase ? `${phasePrefix}${trimmedMsg}` : trimmedMsg
    if (content.length > 2000) {
      setErr(`Please keep your message within ${maxMsgLength} characters for this scope.`)
      return
    }
    const nodeId = selectedTask ? selectedTask.id : null

    setBusy(true)
    setErr('')
    try {
      await submitGuestFeedback(token, {
        reviewerName: name.trim(),
        reviewerRole: role,
        content,
        nodeId,
      })
      setMsg('')
      setOk(true)
      setSentCount((c) => c + 1)
    } catch (error) {
      const backendMsg = error instanceof Error && error.message ? error.message : ''
      setErr(backendMsg || 'Could not send feedback. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  const realPhases = model.phases.filter((p) => p.index >= 0)
  const unphased = model.phases.find((p) => p.index === -1) ?? null
  const phasesWithTasks = model.phases.filter((p) => p.tasks.length > 0)
  const st = model.feedback
  const totalFeedback = st.total + sentCount
  const statusLabel = selectedTask ? (STATUS_CHIP[selectedTask.status]?.[0] ?? selectedTask.status).toLowerCase() : ''

  return (
    <Card
      id="feedback"
      title="Send feedback"
      note={<Sub>One-way: the team reads and resolves it. There is no reply thread.</Sub>}
    >
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-3 w-3" />
        </span>
        {totalFeedback > 0 ? (
          <span>
            The team has resolved{' '}
            <b className="text-slate-800">
              {st.resolved} of {totalFeedback}
            </b>{' '}
            feedback items so far.
          </span>
        ) : (
          <span>No feedback received yet. Yours would be the first.</span>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-2.5 print:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (err) setErr('')
            }}
            maxLength={60}
            aria-label="Your name"
            placeholder="Your name, e.g. Dr. Tran"
            className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
            {(['TEACHER', 'GUEST'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md px-2.5 py-1.5 ${
                  role === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'TEACHER' ? 'Teacher' : 'Guest'}
              </button>
            ))}
          </div>
        </div>

        <select
          value={scope}
          onChange={(e) => onScopeChange(e.target.value)}
          aria-label="Feedback scope"
          className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">About the whole project</option>
          {(realPhases.length > 0 || unphased) && (
            <optgroup label="A whole phase">
              {realPhases.map((p) => (
                <option key={`p-${p.id}`} value={`p:${p.id}`}>
                  {phaseLabel(p)}
                </option>
              ))}
              {unphased && (
                <option key="p-none" value="p:none">
                  Tasks without a phase
                </option>
              )}
            </optgroup>
          )}
          {phasesWithTasks.map((p) => (
            <optgroup key={`t-${p.id}`} label={`Tasks · ${phaseLabel(p)}`}>
              {p.tasks.map((task) => (
                <option key={task.id} value={`t:${task.id}`}>
                  {task.code} · {task.title.length > 48 ? `${task.title.slice(0, 47)}…` : task.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedTask && (
          <p className="-mt-1 text-[11px] text-slate-500">
            Commenting on <span className="font-mono">{selectedTask.code}</span>, status <b>{statusLabel}</b>.
          </p>
        )}

        <textarea
          ref={areaRef}
          value={msg}
          onChange={(e) => {
            setMsg(e.target.value)
            if (err) setErr('')
            if (ok) setOk(false)
          }}
          rows={3}
          maxLength={maxMsgLength}
          aria-label="Feedback content"
          placeholder={
            selectedTask
              ? `Your comments on "${selectedTask.title}"…`
              : selectedPhase
                ? `Your evaluation of ${phaseLabel(selectedPhase)}…`
                : 'Your comments for the team…'
          }
          className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400"
        />

        {err && (
          <p role="alert" className="text-xs text-rose-600">
            {err}
          </p>
        )}
        {ok && (
          <p
            role="status"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800"
          >
            <Check className="h-3.5 w-3.5 shrink-0" /> Sent. The team will see it in their feedback list.
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${msg.length > maxMsgLength ? 'text-rose-600' : 'text-slate-400'}`}>
            {msg.length}/{maxMsgLength}
          </span>
          <button
            type="submit"
            disabled={busy || !msg.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </Card>
  )
}
