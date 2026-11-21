import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useRouter } from '../../router/useRouter'
import { fetchGuestOverview } from '../../services/impl/http/guest'
import type { GuestOverviewDto } from '../../types/guest.types'
import GuestView from '../GuestView'
import { GUEST_REPORT_ENABLED } from './flag'
import { GuestReportErrorBoundary } from './GuestReportErrorBoundary'
import { GuestReportView } from './GuestReportView'

type GateState =
  | { kind: 'loading' }
  | { kind: 'legacy' }
  | { kind: 'ready'; overview: GuestOverviewDto }

export function GuestRouteGate() {
  const { searchParams } = useRouter()
  const token = searchParams.get('token') ?? ''
  const shouldLoadNew = GUEST_REPORT_ENABLED && Boolean(token)

  const [state, setState] = useState<GateState>(() => (shouldLoadNew ? { kind: 'loading' } : { kind: 'legacy' }))

  useEffect(() => {
    if (!shouldLoadNew) {
      setState({ kind: 'legacy' })
      return
    }

    let alive = true
    setState({ kind: 'loading' })

    fetchGuestOverview(token)
      .then((overview) => {
        if (!alive) return
        if (overview && overview.report) {
          setState({ kind: 'ready', overview })
        } else {
          setState({ kind: 'legacy' })
        }
      })
      .catch(() => {
        if (alive) setState({ kind: 'legacy' })
      })

    return () => {
      alive = false
    }
  }, [shouldLoadNew, token])

  if (!shouldLoadNew || state.kind === 'legacy') {
    return <GuestView />
  }

  if (state.kind === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-slate-600"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <p className="text-xs font-medium text-slate-500">Loading project report…</p>
      </div>
    )
  }

  return (
    <GuestReportErrorBoundary key={token} fallback={<GuestView />} onError={() => undefined}>
      <GuestReportView token={token} overview={state.overview} />
    </GuestReportErrorBoundary>
  )
}

export default GuestRouteGate
