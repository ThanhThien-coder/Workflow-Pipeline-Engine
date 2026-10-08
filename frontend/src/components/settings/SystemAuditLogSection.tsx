import { Search } from 'lucide-react'
import type { AuditLogAction, AuditLogItem } from '../../types/settings.types'

interface SystemAuditLogSectionProps {
  logs: AuditLogItem[]
  filterScope: string
  searchQuery: string
  onFilterScopeChange: (scope: string) => void
  onSearchQueryChange: (query: string) => void
}

const EVENT_BADGE: Record<AuditLogAction, string> = {
  MEMBER_INVITED: 'bg-blue-50 text-blue-700 border-blue-200',
  ROLE_CHANGED: 'bg-amber-50 text-amber-700 border-amber-200',
  MEMBER_REMOVED: 'bg-red-50 text-red-700 border-red-200',
  PIPELINE_PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROJECT_UPDATED: 'bg-violet-50 text-violet-700 border-violet-200',
  RESOURCE_ADDED: 'bg-teal-50 text-teal-700 border-teal-200',
  RESOURCE_REMOVED: 'bg-red-50 text-red-700 border-red-200',
  RESOURCE_UPDATED: 'bg-violet-50 text-violet-700 border-violet-200',
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COLLABORATOR: 'bg-blue-50 text-blue-700 border-blue-200',
  VIEWER: 'bg-slate-100 text-slate-600 border-slate-200',
  SYSTEM: 'bg-slate-100 text-slate-600 border-slate-200',
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  } catch {
    return iso
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'
}

const SCOPES = ['All Events', 'Governance', 'Lifecycle', 'Access']

export function SystemAuditLogSection({
  logs,
  filterScope,
  searchQuery,
  onFilterScopeChange,
  onSearchQueryChange,
}: SystemAuditLogSectionProps) {
  const filtered = logs.filter((l) => {
    const matchesScope = filterScope === 'All Events' || l.scope === filterScope
    const q = searchQuery.trim().toLowerCase()
    const matchesQuery =
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.actor.name.toLowerCase().includes(q) ||
      l.scope.toLowerCase().includes(q)
    return matchesScope && matchesQuery
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 pb-3 pt-4">
        <h2 className="text-sm font-bold text-slate-800">System Audit Log</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Immutable chronological record of project governance, permission adjustments, and lifecycle events.
        </p>
      </div>

      <div className="p-5">
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search events, actors, details..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterScope}
            onChange={(e) => onFilterScopeChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {SCOPES.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>

          <span className="ml-auto text-[11px] font-medium text-slate-400">
            {filtered.length} of {logs.length} events
          </span>
        </div>

        <div className="overflow-auto max-h-[400px] -mx-2 sm:mx-0 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar]:h-1.5">
          <table className="w-full min-w-[700px] text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Timestamp</th>
                <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Actor</th>
                <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Event</th>
                <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Details</th>
                <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((logItem) => (
                <tr key={logItem.id} className="align-top transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">
                    {formatTimestamp(logItem.timestamp)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shadow-xs">
                        {getInitials(logItem.actor.name)}
                      </span>
                      <span className="font-semibold text-slate-800">{logItem.actor.name}</span>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
                          ROLE_BADGE[logItem.actor.role] || ROLE_BADGE.SYSTEM
                        }`}
                      >
                        {logItem.actor.role}
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        EVENT_BADGE[logItem.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {logItem.action}
                    </span>
                  </td>

                  <td className="min-w-[240px] px-3 py-2.5 text-slate-600">
                    {logItem.details}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {logItem.scope}
                    </span>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
