import type { ComponentType } from 'react'
import {
  Activity,
  AlertCircle,
  Ban,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderPlus,
  Info,
  Link2,
  Mail,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Shield,
  Unlink,
  UserMinus,
  Unlock,
  UserPlus,
  XCircle,
} from 'lucide-react'
import type { AuditLogItem } from '../../types/settings.types'
import { relativeEn } from '../../utils/relativeTime'

interface SystemAuditLogSectionProps {
  logs: AuditLogItem[]
  filterScope: string
  searchQuery: string
  onFilterScopeChange: (scope: string) => void
  onSearchQueryChange: (query: string) => void
  error?: string | null
}

interface EventMeta {
  label: string
  badge: string
  Icon: ComponentType<{ className?: string }>
}

const DEFAULT_EVENT_META: EventMeta = {
  label: 'Activity',
  badge: 'bg-slate-100 text-slate-700 border-slate-200',
  Icon: Activity,
}

const EVENT_META: Record<string, EventMeta> = {
  PROJECT_CREATED: {
    label: 'Project created',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: FolderPlus,
  },
  PROJECT_STATUS_CHANGED: {
    label: 'Project status changed',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    Icon: RefreshCw,
  },
  MEMBER_JOINED: {
    label: 'Member joined',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    Icon: UserPlus,
  },
  MEMBER_REMOVED: {
    label: 'Member left',
    badge: 'bg-red-50 text-red-700 border-red-200',
    Icon: UserMinus,
  },
  INVITATION_SENT: {
    label: 'Invitation sent',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    Icon: Mail,
  },
  INVITATION_ACCEPTED: {
    label: 'Invitation accepted',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle2,
  },
  INVITATION_REJECTED: {
    label: 'Invitation declined',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    Icon: XCircle,
  },
  INVITATION_REVOKED: {
    label: 'Invitation revoked',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Ban,
  },
  INVITATION_EXPIRED: {
    label: 'Invitation expired',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    Icon: Clock,
  },
  TASK_STATUS_CHANGED: {
    label: 'Task updated',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Icon: CheckSquare,
  },
  ARTIFACT_SUBMITTED: {
    label: 'Artifact submitted',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    Icon: Paperclip,
  },
  GUEST_LINK_CREATED: {
    label: 'Guest link created',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    Icon: Link2,
  },
  GUEST_LINK_REVOKED: {
    label: 'Guest link revoked',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    Icon: Unlink,
  },
  FEEDBACK_CREATED: {
    label: 'Guest feedback',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    Icon: MessageSquare,
  },
  TASK_FORCE_UNLOCKED: {
    label: 'Task unlocked early',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Unlock,
  },
  // Tương thích log từ MockWorkflowService
  MEMBER_INVITED: {
    label: 'Member invited',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    Icon: Mail,
  },
  ROLE_CHANGED: {
    label: 'Role changed',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Shield,
  },
  PIPELINE_PUBLISHED: {
    label: 'Pipeline published',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle2,
  },
  PROJECT_UPDATED: {
    label: 'Project updated',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    Icon: RefreshCw,
  },
  RESOURCE_ADDED: {
    label: 'Resource added',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    Icon: Paperclip,
  },
  RESOURCE_REMOVED: {
    label: 'Resource removed',
    badge: 'bg-red-50 text-red-700 border-red-200',
    Icon: Paperclip,
  },
  RESOURCE_UPDATED: {
    label: 'Resource updated',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    Icon: Paperclip,
  },
}

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'All Events', label: 'All activity types' },
  { value: 'PROJECT_CREATED', label: 'Project created' },
  { value: 'PROJECT_STATUS_CHANGED', label: 'Project status changed' },
  { value: 'MEMBER_JOINED', label: 'Member joined' },
  { value: 'MEMBER_REMOVED', label: 'Member left' },
  { value: 'INVITATION_SENT', label: 'Invitation sent' },
  { value: 'INVITATION_ACCEPTED', label: 'Invitation accepted' },
  { value: 'INVITATION_REJECTED', label: 'Invitation declined' },
  { value: 'INVITATION_REVOKED', label: 'Invitation revoked' },
  { value: 'INVITATION_EXPIRED', label: 'Invitation expired' },
  { value: 'TASK_STATUS_CHANGED', label: 'Task updated' },
  { value: 'TASK_FORCE_UNLOCKED', label: 'Task unlocked early' },
  { value: 'ARTIFACT_SUBMITTED', label: 'Artifact submitted' },
  { value: 'GUEST_LINK_CREATED', label: 'Guest link created' },
  { value: 'GUEST_LINK_REVOKED', label: 'Guest link revoked' },
  { value: 'FEEDBACK_CREATED', label: 'Guest feedback' },
]

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

function formatRelativeTime(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return relativeEn(iso)
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  )
}

export function SystemAuditLogSection({
  logs,
  filterScope,
  searchQuery,
  onFilterScopeChange,
  onSearchQueryChange,
  error,
}: SystemAuditLogSectionProps) {
  const filtered = logs.filter((l) => {
    const eventType = l.type || l.action
    const matchesType =
      filterScope === 'All Events' ||
      eventType === filterScope ||
      l.action === filterScope ||
      l.scope === filterScope
    const q = searchQuery.trim().toLowerCase()
    const matchesQuery =
      !q ||
      String(eventType).toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.actor.name.toLowerCase().includes(q) ||
      (l.targetCode ? l.targetCode.toLowerCase().includes(q) : false)
    return matchesType && matchesQuery
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">System Audit Log</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Activity collected from project data (members, invitations, tasks, artifacts, guest links and feedback).
            </p>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
          <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>Tasks show only their latest update (the system does not keep every change).</span>
        </p>
      </div>

      <div className="p-5">
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search by event, actor or task code..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            aria-label="Filter by activity type"
            value={filterScope}
            onChange={(e) => onFilterScopeChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-[11px] font-medium text-slate-400">
            {filtered.length} / {logs.length} activities
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            data-testid="audit-log-error"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold">Could not load the activity log</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-auto max-h-[400px] -mx-2 sm:mx-0 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar]:h-1.5">
            <table className="w-full min-w-[700px] text-left">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Time</th>
                  <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Actor</th>
                  <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Type</th>
                  <th className="px-3 pb-2.5 pt-2 border-b border-slate-100">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((logItem) => {
                  const eventKey = logItem.type || logItem.action
                  const meta = EVENT_META[eventKey] ?? {
                    ...DEFAULT_EVENT_META,
                    label: eventKey,
                  }
                  const EventIcon = meta.Icon
                  const formattedExact = formatTimestamp(logItem.timestamp)

                  return (
                    <tr key={logItem.id} className="align-top transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-3 py-2.5" title={formattedExact}>
                        <div className="font-medium text-slate-700">{formatRelativeTime(logItem.timestamp)}</div>
                        <div className="font-mono text-[10px] text-slate-400">{formattedExact}</div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shadow-xs">
                            {getInitials(logItem.actor.name)}
                          </span>
                          <span className="font-semibold text-slate-800">{logItem.actor.name}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}
                        >
                          <EventIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className="min-w-[260px] px-3 py-2.5 text-slate-600">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {logItem.targetCode && (
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                              {logItem.targetCode}
                            </span>
                          )}
                          <span>{logItem.details}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr data-testid="audit-log-empty">
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                      {logs.length === 0
                        ? 'No activity in this project yet.'
                        : 'No activity matches the filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
