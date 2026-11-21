import { Code2, FileText, GitPullRequest, Link2, PenTool } from 'lucide-react'
import type { GuestMember, GuestReportPhase } from '../../../domain/guestReport'
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

export function ArtifactIcon({ kind, className = 'h-4 w-4' }: { kind: GuestArtifactKind; className?: string }) {
  switch (kind) {
    case 'PR':
      return <GitPullRequest className={className} />
    case 'DOCS':
      return <FileText className={className} />
    case 'FIGMA':
      return <PenTool className={className} />
    case 'SWAGGER':
      return <Code2 className={className} />
    case 'OTHER_LINK':
    default:
      return <Link2 className={className} />
  }
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
