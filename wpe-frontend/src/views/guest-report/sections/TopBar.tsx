import { Eye, MessageSquare, Printer, Sparkles } from 'lucide-react'
import { fmtDay } from '../ui'

export interface TopBarProps {
  linkExpiresAt: Date | null
  onPrint: () => void
  onFeedback: () => void
}

export function TopBar({ linkExpiresAt, onPrint, onFeedback }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="truncate text-sm font-bold text-slate-900">Pipeline Engine</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 sm:flex">
            <Eye className="h-3.5 w-3.5" />
            {linkExpiresAt ? `Read-only · link valid until ${fmtDay(linkExpiresAt)}` : 'Read-only'}
          </span>
          <button
            type="button"
            onClick={onPrint}
            aria-label="Print / Save PDF"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print / Save PDF</span>
          </button>
          <button
            type="button"
            onClick={onFeedback}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Give feedback</span>
          </button>
        </div>
      </div>
    </header>
  )
}
