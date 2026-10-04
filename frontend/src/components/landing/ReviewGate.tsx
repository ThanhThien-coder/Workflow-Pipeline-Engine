import { useState, type FC } from 'react'

const STC: Record<string, string> = {
  IN_PROGRESS: '#2563eb',
  REVIEW: '#7c3aed',
  DONE: '#059669',
}

export const ReviewGate: FC = () => {
  const [s, setS] = useState<'IN_PROGRESS' | 'REVIEW' | 'DONE'>('IN_PROGRESS')
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [link, setLink] = useState('')

  const send = () => {
    if (!/^https:\/\/[^\s.]+\.[^\s]+/.test(url.trim())) {
      setErr('Enter a valid https:// URL (PR, Figma, API Docs, Zip).')
      return
    }
    setLink(url.trim())
    setS('REVIEW')
    setOpen(false)
    setErr('')
  }

  const c = STC[s]

  return (
    <div
      className="rounded-xl border bg-slate-50 p-4 space-y-3 transition-colors"
      style={{ borderColor: c + '66' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-400">WPE-018</span>
        <span
          className="text-[10px] font-bold rounded-full px-2 py-0.5 border"
          style={{ color: c, borderColor: c + '66' }}
        >
          {s}
        </span>
      </div>

      <div className="font-semibold text-slate-900 text-sm">
        Implement JWT refresh-token rotation
      </div>

      {link && (
        <div className="text-xs text-purple-700 font-mono truncate pop">
          🔗 {link}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {s === 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary-solid text-xs font-semibold text-white rounded-lg px-3 py-1.5"
          >
            Submit for Review
          </button>
        )}

        {s === 'REVIEW' && (
          <>
            <span className="text-[11px] font-semibold text-amber-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">
              Owner Approval Required
            </span>
            <button
              type="button"
              onClick={() => setS('DONE')}
              className="text-xs font-semibold text-emerald-700 border border-emerald-200 bg-white hover:bg-emerald-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              Approve as Owner
            </button>
          </>
        )}

        {s === 'DONE' && (
          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            ✓ Accepted by Owner
          </span>
        )}
      </div>

      {open && (
        <div className="pop rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Attach evidence URL</div>
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="https://github.com/acme/repo/pull/142"
            className="w-full text-xs rounded-md bg-white border border-slate-200 px-2.5 py-1.5 outline-none focus:border-indigo-500"
          />
          {err && <div className="text-[11px] text-rose-600">{err}</div>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setErr('')
              }}
              className="text-xs text-slate-600 px-2 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              className="btn-primary-solid text-xs font-semibold text-white rounded-md px-3 py-1"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
