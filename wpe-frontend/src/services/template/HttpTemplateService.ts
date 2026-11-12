import type { ITemplateService } from './ITemplateService';
import type {
  TemplateFilter,
  TemplateSummaryDto,
  TemplateDetailDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  SaveProjectAsTemplateRequestDto,
  GraphDataPayload,
  DagValidationResult,
} from '../../types/template.types';
import { apiRequest } from '../http/apiClient';

export class HttpTemplateService implements ITemplateService {
  async getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    const query: Record<string, string | boolean> = {};
    if (filter?.category && filter.category !== 'All') {
      query.category = filter.category;
    }
    if (filter?.search) {
      query.search = filter.search;
    }
    if (filter?.isSystemStandard !== undefined) {
      query.isSystemStandard = filter.isSystemStandard;
    }

    return apiRequest<TemplateSummaryDto[]>('GET', '/templates', {
      query: Object.keys(query).length > 0 ? query : undefined,
    });
  }

  async getAllTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    return this.getTemplates(filter);
  }

  async getTemplateById(id: string): Promise<TemplateDetailDto> {
    return apiRequest<TemplateDetailDto>('GET', `/templates/${id}`);
  }

  async createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto> {
    return apiRequest<TemplateDetailDto>('POST', '/templates', { body: dto });
  }

  async updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto> {
    return apiRequest<TemplateDetailDto>('PUT', `/templates/${id}`, { body: dto });
  }

  async deleteTemplate(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/templates/${id}`);
  }

  async validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult> {
    const data = await apiRequest<{
      valid?: boolean;
      isValid?: boolean;
      visitedCount?: number;
      totalCount?: number;
      violations?: Array<{
        scope?: string;
        phaseId?: string;
        nodeIds?: string[];
        nodeId?: string;
        cycleNodes?: string[];
      }>;
    }>('POST', '/templates/validate', {
      body: { graphData, ...graphData },
    });

    return {
      valid: data.valid ?? data.isValid ?? (data.violations?.length === 0),
      visitedCount: data.visitedCount ?? 0,
      totalCount: data.totalCount ?? 0,
      violations: (data.violations || []).map((v) => ({
        scope: (v.scope || (v.nodeId ? 'NODE' : 'PHASE')) as 'PHASE' | 'NODE',
        phaseId: v.phaseId,
        nodeIds: v.nodeIds || (v.nodeId ? [v.nodeId] : (v.cycleNodes || [])),
      })),
    };
  }

  async saveProjectAsTemplate(
    projectId: string,
    payload: SaveProjectAsTemplateRequestDto
  ): Promise<TemplateDetailDto> {
    return apiRequest<TemplateDetailDto>('POST', `/projects/${projectId}/save-as-template`, {
      body: payload,
    });
  }
}
