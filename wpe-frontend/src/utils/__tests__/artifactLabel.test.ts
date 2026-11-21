import { describe, expect, it } from 'vitest'
import type { ArtifactItem } from '../../types/kanban.types'
import { artifactLabel } from '../artifactLabel'

function makeItem(over: Partial<ArtifactItem>): ArtifactItem {
  return {
    id: 'a1',
    type: 'DOCS',
    url: 'https://example.com',
    note: '',
    uploadedAt: '2026-11-20T00:00:00Z',
    ...over,
  }
}

describe('artifactLabel', () => {
  it('ưu tiên label nếu có', () => {
    expect(artifactLabel(makeItem({ label: 'Custom Spec', url: 'https://figma.com/file/1' }))).toBe('Custom Spec')
  })

  it('trả về PR #N cho pull request GitHub', () => {
    expect(artifactLabel(makeItem({ type: 'PR', url: 'https://github.com/org/repo/pull/12' }))).toBe('PR #12')
    expect(artifactLabel(makeItem({ type: 'DOCS', url: 'https://github.com/org/repo/pull/42' }))).toBe('PR #42')
  })

  it('trả về siteLabel(url) cho các link khác thay vì tên loại', () => {
    expect(artifactLabel(makeItem({ type: 'PR', url: 'https://www.figma.com/file/abc' }))).toBe('Figma')
    expect(artifactLabel(makeItem({ type: 'DOCS', url: 'https://docs.google.com/document/d/1' }))).toBe('Google Docs')
    expect(artifactLabel(makeItem({ type: 'ZIP', url: 'https://notion.so/page-1' }))).toBe('Notion')
    expect(artifactLabel(makeItem({ type: 'DOCS', url: 'https://custom.dev/docs' }))).toBe('custom.dev')
  })
})
