import type {
  TemplateFilter,
  TemplateSummaryDto,
  TemplateDetailDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  GraphDataPayload,
  DagValidationResult,
} from '../../types/template.types';

export interface ITemplateService {
  getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]>;
  getTemplateById(id: string): Promise<TemplateDetailDto>;
  createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto>;
  updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto>;
  deleteTemplate(id: string): Promise<void>;
  validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult>;
}
