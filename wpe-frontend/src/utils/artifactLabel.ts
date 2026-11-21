import { brandOf, siteLabel } from '../components/common/SiteIcon'
import type { ArtifactItem } from '../types/kanban.types'

export function artifactLabel(artifact: ArtifactItem): string {
  if (artifact.label) return artifact.label
  const match = artifact.url.match(/\/pull\/(\d+)/)
  if (match && (brandOf(artifact.url)?.key === 'github' || artifact.type === 'PR')) {
    return `PR #${match[1]}`
  }
  return siteLabel(artifact.url)
}

export const isValidArtifactUrl = (url: string): boolean => /^https?:\/\/\S+\.\S+/.test(url.trim())
