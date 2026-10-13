import type {
  ProjectCardVm,
  ProjectRole,
  ProjectSummaryDto,
  ProjectTone,
} from '../types/workspace.types'

const TONES: ProjectTone[] = ['indigo', 'amber', 'sky', 'emerald', 'violet', 'slate']
const ICONS: string[] = ['◆', '▲', '⬢', '◉', '■', '▣']

const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  COLLABORATOR: 'Collaborator',
  VIEWER: 'Viewer',
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) {
    return 'Updated recently'
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  if (diffMs < 0) return 'Updated just now'

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 2) return 'Updated just now'
  if (diffMin < 60) return `Updated ${diffMin} minutes ago`
  if (diffHours === 1) return 'Updated 1 hour ago'
  if (diffHours < 24) return `Updated ${diffHours} hours ago`
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 7) return `Updated ${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function mapProjectDtoToVm(dto: ProjectSummaryDto): ProjectCardVm {
  const numericId = typeof dto.id === 'number' ? dto.id : parseInt(String(dto.id).replace(/\D/g, ''), 10) || 0
  const index = Math.abs(numericId - 1) % TONES.length

  const tone = TONES[index] ?? 'indigo'
  const icon = ICONS[index] ?? '◆'

  const dateMs = new Date(dto.updatedAt).getTime()
  const ts = isNaN(dateMs) ? Date.now() : dateMs

  return {
    id: dto.id,
    name: dto.name,
    desc: dto.description,
    status: dto.status,
    role: dto.role,
    nodes: dto.nodeCount,
    crit: dto.criticalPathLength,
    done: dto.completionPercent,
    upd: formatRelativeTime(dto.updatedAt),
    ts,
    tone,
    icon,
    roleLabel: ROLE_LABELS[dto.role] ?? 'Viewer',
    members: dto.members.map((m) => m.displayName),
  }
}
