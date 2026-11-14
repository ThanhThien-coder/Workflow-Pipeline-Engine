export type TemplateCategory =
  | 'Software Engineering'
  | 'Marketing'
  | 'DevOps & Infra'
  | 'General';

export type JoinPolicy = 'ALL_COMPLETED' | 'ANY_COMPLETED';

export type EdgeKind = 'DEPENDENCY';

export interface UiPosition {
  x: number;
  y: number;
}

export interface UiMetadata {
  position: UiPosition;
}

export interface PhaseDto {
  id: string;
  name: string;
  order: number;
  rootNodeId: string;
  uiMetadata: UiMetadata;
  runsAfter?: string[];
}

export interface PhaseEdgeDto {
  parentPhaseId: string;
  childPhaseId: string;
}

export interface TemplateNodeDto {
  id: string;
  phaseId: string;
  parentId: string | null;
  trackId: string | null;
  title: string;
  description: string;
  level: number;
  joinPolicy: JoinPolicy;
  uiMetadata: UiMetadata;
}

export interface NodeEdgeDto {
  id: string;
  parentId: string;
  childId: string;
  kind: EdgeKind;
}

export interface GraphDataPayload {
  schemaVersion: 2;
  phases: PhaseDto[];
  phaseEdges: PhaseEdgeDto[];
  nodes: TemplateNodeDto[];
  edges: NodeEdgeDto[];
  metadata: {
    version: string;
  };
}

export interface TemplateSummaryDto {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  isSystemStandard: boolean;
  phaseCount: number;
  nodeCount: number;
  cloneCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  sourceProjectId?: string | null;
  isHidden?: boolean;
}

export interface SaveProjectAsTemplateRequestDto {
  name: string;
  description?: string;
  category?: string;
}

export interface TemplateDetailDto extends TemplateSummaryDto {
  graphData: GraphDataPayload;
}

export interface CreateTemplateRequestDto {
  name: string;
  description?: string;
  category: TemplateCategory;
  isSystemStandard: boolean;
  graphData: GraphDataPayload;
}

export type UpdateTemplateRequestDto = CreateTemplateRequestDto;

export interface TemplateFilter {
  search?: string;
  category?: TemplateCategory | 'All';
  isSystemStandard?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  includeHidden?: boolean;
}

export interface DagViolation {
  scope: 'PHASE' | 'NODE';
  phaseId?: string;
  nodeIds: string[];
}

export interface DagValidationResult {
  valid: boolean;
  visitedCount: number;
  totalCount: number;
  violations: DagViolation[];
}
