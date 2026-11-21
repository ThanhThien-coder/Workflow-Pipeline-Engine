import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { GuestReportModel } from '../../../domain/guestReport'
import { Card, Sub, fmtDay } from '../ui'
import { ARTIFACT_LABELS, ArtifactIcon } from './helpers'

const LIMIT = 6

export interface EvidenceCardProps {
  model: GuestReportModel
  onGoTask: (taskId: string) => void
}

export function EvidenceCard({ model, onGoTask }: EvidenceCardProps) {
  const artifacts = model.artifacts
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? artifacts.filter((a) =>
        [a.name, a.taskCode, a.host, ARTIFACT_LABELS[a.kind]].some((s) => s.toLowerCase().includes(trimmed)),
      )
    : artifacts

  const shown = all ? filtered : filtered.slice(0, LIMIT)

  return (
    <Card
      className="h-full"
      title="Deliverables"
      note={<Sub>Links the team made visible on this page, newest first.</Sub>}
      right={
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {artifacts.length}
        </span>
      }
    >
      {artifacts.length > LIMIT && (
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAll(false)
          }}
          aria-label="Search deliverables"
          placeholder="Search by name, task code or site…"
          className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:bg-white print:hidden"
        />
      )}

      {artifacts.length === 0 && <p className="text-sm text-slate-400">No public deliverables yet.</p>}
      {artifacts.length > 0 && filtered.length === 0 && (
        <p className="py-3 text-center text-xs text-slate-400">Nothing matches “{query}”.</p>
      )}

      <div className={`space-y-0.5 ${all ? 'max-h-80 overflow-y-auto pr-1 print:max-h-none print:overflow-visible' : ''}`}>
        {shown.map((a, i) => (
          <div
            key={a.id}
            className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 ${
              i >= LIMIT ? 'print:hidden' : ''
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ArtifactIcon kind={a.kind} />
            </span>

            <span className="min-w-0 flex-1">
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700"
                  title={a.url}
                >
                  {a.name}
                </a>
              ) : (
                <span className="block truncate text-sm font-medium text-slate-800">{a.name}</span>
              )}

              <span className="block truncate text-[11px] text-slate-500">
                {a.taskCode && a.nodeId && (
                  <>
                    <button
                      type="button"
                      onClick={() => onGoTask(a.nodeId!)}
                      className="font-mono hover:text-indigo-700 hover:underline"
                    >
                      {a.taskCode}
                    </button>
                    {' · '}
                  </>
                )}
                {a.host && (
                  <>
                    {a.host}
                    {' · '}
                  </>
                )}
                {fmtDay(a.createdAt)}
              </span>
            </span>

            {a.url && (
              <span className="shrink-0 text-slate-300 group-hover:text-indigo-500 print:hidden" aria-hidden="true">
                <ExternalLink className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
      </div>

      {filtered.length > LIMIT && (
        <button
          type="button"
          onClick={() => setAll((prev) => !prev)}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 print:hidden"
        >
          {all ? 'Show fewer' : `Show all ${filtered.length}`}
        </button>
      )}

      {filtered.length > LIMIT && (
        <p className="mt-1 hidden text-[11px] text-slate-500 print:block">
          …and {filtered.length - LIMIT} more on the page.
        </p>
      )}
    </Card>
  )
}
