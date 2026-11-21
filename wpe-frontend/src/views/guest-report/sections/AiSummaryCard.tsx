import { useEffect, useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { daysBetween } from '../../../domain/guestReport'
import { fetchGuestAiSummary } from '../../../services/impl/http/guest'
import type { GuestAiSummaryDto } from '../../../types/guest.types'
import { Card, plural } from '../ui'

export interface AiSummaryCardProps {
  token: string
  serverNow: Date
}

export function AiSummaryCard({ token, serverNow }: AiSummaryCardProps) {
  const [ai, setAi] = useState<GuestAiSummaryDto | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setAi(null)
    fetchGuestAiSummary(token)
      .then((res) => {
        if (!alive) return
        if (res && res.content && res.content.trim()) {
          setAi(res)
        }
      })
      .catch(() => {
        if (alive) setAi(null)
      })
    return () => {
      alive = false
    }
  }, [token])

  if (!ai) return null

  const parsedGen = ai.generatedAt ? new Date(ai.generatedAt) : null
  const validGen = parsedGen && !Number.isNaN(parsedGen.getTime()) ? parsedGen : null
  const agoDays = validGen ? Math.max(0, daysBetween(validGen, serverNow)) : null
  const stale = agoDays !== null && agoDays > 7
  const hasDetails = ai.highlights.length > 0 || ai.risks.length > 0

  const head = (
    <span className="flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-indigo-500" />
      <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">AI summary</span>
    </span>
  )

  const right =
    agoDays !== null ? (
      <span className={`shrink-0 text-right text-[11px] ${stale ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>
        {agoDays === 0 ? 'Generated today' : `Generated ${plural(agoDays, 'day')} ago`}
        {stale && ' · may be outdated'}
      </span>
    ) : undefined

  return (
    <Card className="border-indigo-200" title={head} right={right}>
      <p className="whitespace-pre-line text-sm text-slate-700">{ai.content}</p>
      {hasDetails && (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline print:hidden"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
            {open ? 'Hide' : 'Show'} suggested next steps & risks
          </button>
          <div className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${open ? '' : 'hidden'} print:grid`}>
            {ai.highlights.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                <li className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Suggested next steps</li>
                {ai.highlights.map((item, idx) => (
                  <li key={`${idx}-${item}`}>✓ {item}</li>
                ))}
              </ul>
            )}
            {ai.risks.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                <li className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Risks</li>
                {ai.risks.map((item, idx) => (
                  <li key={`${idx}-${item}`}>! {item}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <p className="mt-2.5 text-[11px] text-slate-400">AI-generated from project data and may be inaccurate.</p>
    </Card>
  )
}
