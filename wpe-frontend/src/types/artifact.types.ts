export interface ProjectArtifact {
  id: string
  title: string        // Display name (e.g., "Figma UI Prototype", "PR #42 Backend", "Swagger API")
  url: string          // Destination link (https://...)
  createdAt?: string
  createdBy?: string
}

export const INITIAL_PROJECT_ARTIFACTS: ProjectArtifact[] = [
  { id: '1', title: 'Figma Design System', url: 'https://figma.com/file/123/design-system', createdAt: 'Sep 12, 2026', createdBy: 'Alex Kim' },
  { id: '2', title: 'API Documentation', url: 'https://api.pipeline.engine/docs/v2', createdAt: 'Sep 15, 2026', createdBy: 'Sarah Chen' },
  { id: '3', title: 'Marketing Assets Drive', url: 'https://drive.google.com/drive/folders/marketing-q4', createdAt: 'Oct 01, 2026', createdBy: 'Michael Brown' },
  { id: '4', title: 'Competitor Analysis', url: 'https://notion.so/pipeline/competitor-analysis', createdAt: 'Oct 05, 2026', createdBy: 'Emma Watson' },
  { id: '5', title: 'Launch Checklist', url: 'https://docs.google.com/spreadsheets/launch', createdAt: 'Oct 08, 2026', createdBy: 'Alex Kim' },
]
