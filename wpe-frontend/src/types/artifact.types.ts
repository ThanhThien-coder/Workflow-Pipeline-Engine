export type ArtifactType = 'PR' | 'FIGMA' | 'DOCS' | 'SWAGGER' | 'OTHER_LINK';

export interface ArtifactItem {
  id: string;
  projectId: string;
  nodeId?: string | null;
  name: string;             // Đổi từ title sang name để khớp schema DB
  title?: string;           // Backward compatibility alias
  type: ArtifactType;
  url: string;
  isInRepository: boolean;
  isPublicForGuest: boolean;
  uploadedBy?: string | null;
  createdAt: string;
}

export type ProjectArtifact = ArtifactItem;

export interface CreateArtifactCommand {
  name: string;
  url: string;
  type?: ArtifactType;
  nodeId?: string | null;
  isInRepository?: boolean;
}

export const INITIAL_PROJECT_ARTIFACTS: ArtifactItem[] = [
  { id: '1', projectId: '1', name: 'Figma Design System', title: 'Figma Design System', type: 'FIGMA', url: 'https://figma.com/file/123/design-system', isInRepository: true, isPublicForGuest: true, createdAt: 'Sep 12, 2026', uploadedBy: 'Alex Kim' },
  { id: '2', projectId: '1', name: 'API Documentation', title: 'API Documentation', type: 'SWAGGER', url: 'https://api.pipeline.engine/docs/v2', isInRepository: true, isPublicForGuest: true, createdAt: 'Sep 15, 2026', uploadedBy: 'Sarah Chen' },
  { id: '3', projectId: '1', name: 'Marketing Assets Drive', title: 'Marketing Assets Drive', type: 'DOCS', url: 'https://drive.google.com/drive/folders/marketing-q4', isInRepository: true, isPublicForGuest: true, createdAt: 'Oct 01, 2026', uploadedBy: 'Michael Brown' },
  { id: '4', projectId: '1', name: 'Competitor Analysis', title: 'Competitor Analysis', type: 'DOCS', url: 'https://notion.so/pipeline/competitor-analysis', isInRepository: true, isPublicForGuest: true, createdAt: 'Oct 05, 2026', uploadedBy: 'Emma Watson' },
  { id: '5', projectId: '1', name: 'Launch Checklist', title: 'Launch Checklist', type: 'DOCS', url: 'https://docs.google.com/spreadsheets/launch', isInRepository: true, isPublicForGuest: true, createdAt: 'Oct 08, 2026', uploadedBy: 'Alex Kim' },
];
