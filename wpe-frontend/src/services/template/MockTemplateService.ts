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

export const TEMPLATES_STORAGE_KEY = 'wpe_templates_mock_db_v2';
export const TEMPLATES_UPDATED_EVENT = 'wpe_template_updated';

let memoryTemplates: TemplateDetailDto[] = structuredClone(initialMockTemplates);

function loadPersistedTemplates(): TemplateDetailDto[] {
  if (typeof window === 'undefined') return memoryTemplates;
  try {
    const raw = window.localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load templates from localStorage:', err);
  }
  return initialMockTemplates;
}

function persistTemplates(templates: TemplateDetailDto[]): void {
  if (typeof window === 'undefined') {
    memoryTemplates = structuredClone(templates);
    return;
  }
  try {
    window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new CustomEvent(TEMPLATES_UPDATED_EVENT));
  } catch (err) {
    console.warn('Failed to persist templates to localStorage:', err);
  }
}

export class MockTemplateService implements ITemplateService {
  private templates: TemplateDetailDto[];

  constructor(initialData?: TemplateDetailDto[]) {
    this.templates = initialData
      ? structuredClone(initialData)
      : structuredClone(loadPersistedTemplates());
  }

  async getAllTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    return this.getTemplates(filter);
  }

  async getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    await delay(250);
    this.templates = loadPersistedTemplates();
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
    this.templates = loadPersistedTemplates();
    const found = this.templates.find((t) => t.id === id);
    if (!found) {
      throw new Error(`Template not found with ID: ${id}`);
    }
    return structuredClone(found);
  }

  async createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto> {
    await delay(100);
    this.templates = loadPersistedTemplates();
    const validation = validateTemplateGraph(dto.graphData);
    if (!validation.valid) {
      throw new Error('Validation failed: Graph contains cyclic dependencies or integrity violations');
    }

    const now = new Date().toISOString();
    const newId = (dto as any).id || `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

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

    this.templates = this.templates.filter((t) => t.id !== newId);
    this.templates.unshift(newTemplate);
    persistTemplates(this.templates);
    return structuredClone(newTemplate);
  }

  async updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto> {
    await delay(100);
    this.templates = loadPersistedTemplates();
    const validation = validateTemplateGraph(dto.graphData);
    if (!validation.valid) {
      throw new Error('Validation failed: Graph contains cyclic dependencies or integrity violations');
    }

    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      // Upsert: if template was not yet persisted under this ID, create it under this ID
      return this.createTemplate({ ...dto, id } as any);
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
    persistTemplates(this.templates);
    return structuredClone(updated);
  }

  async deleteTemplate(id: string): Promise<void> {
    await delay(250);
    this.templates = loadPersistedTemplates();
    const index = this.templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.templates.splice(index, 1);
      persistTemplates(this.templates);
    }
  }

  resetToDefault(): void {
    this.templates = structuredClone(initialMockTemplates);
    persistTemplates(this.templates);
  }

  async validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult> {
    await delay(100);
    return validateTemplateGraph(graphData);
  }
}
