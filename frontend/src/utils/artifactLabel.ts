import type { ArtifactItem, ArtifactType } from '../types/kanban.types'
export const ARTIFACT_TYPE_OPTIONS: { value: ArtifactType; label: string }[] = [
  { value: 'PR', label: 'GitHub PR Link' }, { value: 'FIGMA', label: 'Figma URL' }, { value: 'DOCS', label: 'Tài liệu API' }, { value: 'ZIP', label: 'Zip' },
]
export function artifactLabel(artifact: ArtifactItem): string {
  if (artifact.label) return artifact.label
  const match = artifact.url.match(/\/pull\/(\d+)/)
  if (artifact.type === 'PR' && match) return `PR #${match[1]}`
  return ARTIFACT_TYPE_OPTIONS.find((option) => option.value === artifact.type)?.label ?? artifact.type
}
export const isValidArtifactUrl = (url: string): boolean => /^https?:\/\/\S+\.\S+/.test(url.trim())
