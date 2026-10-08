import type { ITemplateService } from './ITemplateService';
import type {
  TemplateFilter,
  TemplateSummaryDto,
  TemplateDetailDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  GraphDataPayload,
  DagValidationResult,
} from '../../types/template.types';
import { initialMockTemplates } from './mockTemplateData';
import { validateTemplateGraph } from '../../lib/graph/kahn';

const delay = (ms: number = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockTemplateService implements ITemplateService {
  private templates: TemplateDetailDto[];

  constructor(initialData: TemplateDetailDto[] = initialMockTemplates) {
    this.templates = structuredClone(initialData);
  }

  async getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    await delay(250);
    let list = this.templates;

    if (filter) {
      if (filter.category && filter.category !== 'All') {
        list = list.filter((t) => t.category === filter.category);
      }
      if (filter.isSystemStandard !== undefined) {
        list = list.filter((t) => t.isSystemStandard === filter.isSystemStandard);
      }
      if (filter.search && filter.search.trim().length > 0) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q))
        );
      }
    }

    // Map to summaries
    return list.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      isSystemStandard: t.isSystemStandard,
      phaseCount: t.graphData.phases.length,
      nodeCount: t.graphData.nodes.length,
      cloneCount: t.cloneCount,
      createdBy: t.createdBy,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getTemplateById(id: string): Promise<TemplateDetailDto> {
    await delay(200);
    const found = this.templates.find((t) => t.id === id);
    if (!found) {
      throw new Error(`Template not found with ID: ${id}`);
    }
    return structuredClone(found);
  }

  async createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto> {
    await delay(300);
    const validation = validateTemplateGraph(dto.graphData);
    if (!validation.valid) {
      throw new Error('Validation failed: Graph contains cyclic dependencies or integrity violations');
    }

    const now = new Date().toISOString();
    const newId = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const newTemplate: TemplateDetailDto = {
      id: newId,
      name: dto.name,
      description: dto.description || null,
      category: dto.category,
      isSystemStandard: dto.isSystemStandard,
      phaseCount: dto.graphData.phases.length,
      nodeCount: dto.graphData.nodes.length,
      cloneCount: 0,
      createdBy: 'Super Admin',
      createdAt: now,
      updatedAt: now,
      graphData: structuredClone(dto.graphData),
    };

    this.templates.unshift(newTemplate);
    return structuredClone(newTemplate);
  }

  async updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto> {
    await delay(300);
    const validation = validateTemplateGraph(dto.graphData);
    if (!validation.valid) {
      throw new Error('Validation failed: Graph contains cyclic dependencies or integrity violations');
    }

    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Template not found with ID: ${id}`);
    }

    const existing = this.templates[index];
    const now = new Date().toISOString();

    const updated: TemplateDetailDto = {
      ...existing,
      name: dto.name,
      description: dto.description || null,
      category: dto.category,
      isSystemStandard: dto.isSystemStandard,
      phaseCount: dto.graphData.phases.length,
      nodeCount: dto.graphData.nodes.length,
      updatedAt: now,
      graphData: structuredClone(dto.graphData),
    };

    this.templates[index] = updated;
    return structuredClone(updated);
  }

  async deleteTemplate(id: string): Promise<void> {
    await delay(250);
    const index = this.templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.templates.splice(index, 1);
    }
  }

  async validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult> {
    await delay(100);
    return validateTemplateGraph(graphData);
  }
}
