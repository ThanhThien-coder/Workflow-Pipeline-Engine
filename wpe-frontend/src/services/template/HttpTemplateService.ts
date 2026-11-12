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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('wpe_auth_token') || sessionStorage.getItem('wpe_auth_token'))
    : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export class HttpTemplateService implements ITemplateService {
  async getTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    let url = `${API_BASE_URL}/templates`;
    const params = new URLSearchParams();
    if (filter?.category && filter.category !== 'All') {
      params.append('category', filter.category);
    }
    if (filter?.search) {
      params.append('search', filter.search);
    }
    const query = params.toString();
    if (query) {
      url += `?${query}`;
    }

    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to fetch templates: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getAllTemplates(filter?: TemplateFilter): Promise<TemplateSummaryDto[]> {
    return this.getTemplates(filter);
  }

  async getTemplateById(id: string): Promise<TemplateDetailDto> {
    const res = await fetch(`${API_BASE_URL}/templates/${id}`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch template #${id}: HTTP ${res.status}`);
    }
    return res.json();
  }

  async createTemplate(dto: CreateTemplateRequestDto): Promise<TemplateDetailDto> {
    const res = await fetch(`${API_BASE_URL}/templates`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create template: HTTP ${res.status}`);
    }
    return res.json();
  }

  async updateTemplate(id: string, dto: UpdateTemplateRequestDto): Promise<TemplateDetailDto> {
    const res = await fetch(`${API_BASE_URL}/templates/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update template #${id}: HTTP ${res.status}`);
    }
    return res.json();
  }

  async deleteTemplate(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete template #${id}: HTTP ${res.status}`);
    }
  }

  async validateGraph(graphData: GraphDataPayload): Promise<DagValidationResult> {
    const res = await fetch(`${API_BASE_URL}/templates/validate`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ graphData, ...graphData }),
    });
    if (!res.ok) {
      throw new Error(`Graph validation failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      valid: data.valid ?? data.isValid ?? (data.violations?.length === 0),
      visitedCount: data.visitedCount ?? 0,
      totalCount: data.totalCount ?? 0,
      violations: (data.violations || []).map((v: any) => ({
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
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/save-as-template`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to save project as template: HTTP ${res.status}`);
    }
    return res.json();
  }
}
