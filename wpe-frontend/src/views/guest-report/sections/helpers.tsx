import { SiteIcon } from '../../../components/common/SiteIcon'
import type { GuestMember, GuestReportPhase, GuestTask } from '../../../domain/guestReport'
import type { GuestArtifactKind } from '../../../types/guest.types'
import type { AvatarPerson } from '../ui'

export const ARTIFACT_KINDS: readonly GuestArtifactKind[] = [
  'PR',
  'DOCS',
  'FIGMA',
  'SWAGGER',
  'OTHER_LINK',
]

export const ARTIFACT_LABELS: Record<GuestArtifactKind, string> = {
  PR: 'Code',
  DOCS: 'Docs',
  FIGMA: 'Figma',
  SWAGGER: 'API spec',
  OTHER_LINK: 'Link',
}

export function ArtifactIcon({
  url,
  size = 16,
  className = '',
}: {
  url: string | null | undefined
  size?: number
  className?: string
}) {
  return <SiteIcon url={url} size={size} className={className} />
}

export function phaseLabel(phase: Pick<GuestReportPhase, 'index' | 'name'>): string {
  return phase.index >= 0 ? `Phase ${phase.index + 1} · ${phase.name}` : 'No phase'
}

export function formatMemberRole(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    COLLABORATOR: 'Collaborator',
    VIEWER: 'Viewer',
    FORMER: 'Former member',
  }
  return map[role.toUpperCase()] ?? role
}

export function buildAvatarMap(members: readonly GuestMember[]): Record<string, AvatarPerson> {
  const map: Record<string, AvatarPerson> = {}
  members.forEach((member, index) => {
    map[member.id] = {
      name: member.name,
      initials: member.initials,
      colorIndex: index,
    }
  })
  return map
}

/**
 * Câu ở thẻ On time khi chưa tính được %: task chưa có hạn chót thì không bao giờ đúng hạn hay trễ,
 * nên phải nói rõ "chưa có hạn chót" thay vì "chưa tới hạn" (dễ hiểu nhầm khi có task đang làm).
 */
export function onTimeEmptyText(tasks: Pick<GuestTask, 'due'>[]): string {
  if (tasks.length === 0) return 'No tasks yet'
  if (tasks.every((t) => t.due === null)) return 'No task has a due date yet, so nothing is on time or late'
  return 'No task has reached its due date yet'
}
