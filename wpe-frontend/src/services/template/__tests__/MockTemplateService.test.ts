import { describe, it, expect, beforeEach } from 'vitest';
import { MockTemplateService } from '../MockTemplateService';
import type { CreateTemplateRequestDto } from '../../../types/template.types';

describe('Service Layer DI: MockTemplateService Unit Tests', () => {
  let service: MockTemplateService;

  beforeEach(() => {
    service = new MockTemplateService();
    service.resetToDefault();
  });

  it('should fetch 3 default templates with correct summaries', async () => {
    const list = await service.getTemplates();
    expect(list).toHaveLength(3);
    expect(list.map((t) => t.name)).toContain('Standard Software Development (SDLC)');
    expect(list.map((t) => t.name)).toContain('Marketing Campaign Launch');
    expect(list.map((t) => t.name)).toContain('Data Science / ETL Pipeline');
  });

  it('should filter templates by search query and category', async () => {
    const searchResult = await service.getTemplates({ search: 'marketing' });
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].category).toBe('Marketing');

    const catResult = await service.getTemplates({ category: 'Software Engineering' });
    expect(catResult).toHaveLength(1);
    expect(catResult[0].name).toBe('Standard Software Development (SDLC)');
  });

  it('should retrieve template details by ID', async () => {
    const list = await service.getTemplates();
    const target = list[0];

    const detail = await service.getTemplateById(target.id);
    expect(detail.id).toBe(target.id);
    expect(detail.graphData.phases.length).toBeGreaterThan(0);
    expect(detail.graphData.nodes.length).toBeGreaterThan(0);
  });

  it('should create new template after passing DAG validation', async () => {
    const newDto: CreateTemplateRequestDto = {
      name: 'Custom DevOps Pipeline',
      description: 'Automated CI/CD workflow',
      category: 'DevOps & Infra',
      isSystemStandard: true,
      graphData: {
        schemaVersion: 2,
        phases: [
          {
            id: 'ph-test-1',
            name: 'Build',
            order: 0,
            rootNodeId: 'nd-b-0',
            uiMetadata: { position: { x: 0, y: 0 } },
          },
        ],
        phaseEdges: [],
        nodes: [
          {
            id: 'nd-b-0',
            phaseId: 'ph-test-1',
            parentId: null,
            trackId: null,
            title: 'Build',
            description: '',
            level: 0,
            joinPolicy: 'ALL_COMPLETED',
            uiMetadata: { position: { x: 0, y: 0 } },
          },
        ],
        edges: [],
        metadata: { version: '1.0' },
      },
    };

    const created = await service.createTemplate(newDto);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Custom DevOps Pipeline');

    const all = await service.getTemplates();
    expect(all).toHaveLength(4);
  });

  it('should reject template creation when cyclic graph is supplied', async () => {
    const cyclicDto: CreateTemplateRequestDto = {
      name: 'Invalid Cyclic Pipeline',
      category: 'General',
      isSystemStandard: false,
      graphData: {
        schemaVersion: 2,
        phases: [
          { id: 'p1', name: 'P1', order: 0, rootNodeId: 'n1', uiMetadata: { position: { x: 0, y: 0 } } },
          { id: 'p2', name: 'P2', order: 1, rootNodeId: 'n2', uiMetadata: { position: { x: 0, y: 0 } } },
        ],
        phaseEdges: [
          { parentPhaseId: 'p1', childPhaseId: 'p2' },
          { parentPhaseId: 'p2', childPhaseId: 'p1' }, // Cycle!
        ],
        nodes: [
          { id: 'n1', phaseId: 'p1', parentId: null, trackId: null, title: 'P1', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
          { id: 'n2', phaseId: 'p2', parentId: null, trackId: null, title: 'P2', description: '', level: 0, joinPolicy: 'ALL_COMPLETED', uiMetadata: { position: { x: 0, y: 0 } } },
        ],
        edges: [],
        metadata: { version: '1.0' },
      },
    };

    await expect(service.createTemplate(cyclicDto)).rejects.toThrow('Validation failed');
  });

  it('should delete a template successfully', async () => {
    const list = await service.getTemplates();
    const idToDelete = list[0].id;

    await service.deleteTemplate(idToDelete);
    const updatedList = await service.getTemplates();
    expect(updatedList).toHaveLength(2);
    expect(updatedList.some((t) => t.id === idToDelete)).toBe(false);
  });

  it("should filter templates by visibility: 'PUBLIC' excluding PRIVATE templates", async () => {
    await service.saveProjectAsTemplate('proj-1', { name: 'Private Exported Template' });
    const all = await service.getTemplates();
    expect(all.some((t) => t.visibility === 'PRIVATE')).toBe(true);

    const publicOnly = await service.getTemplates({ visibility: 'PUBLIC' });
    expect(publicOnly.length).toBeGreaterThan(0);
    expect(publicOnly.some((t) => t.visibility === 'PRIVATE')).toBe(false);
    expect(publicOnly.every((t) => (t.visibility ?? 'PUBLIC') === 'PUBLIC')).toBe(true);
  });

  it('should exclude hidden templates by default, and include them with includeHidden=true', async () => {
    const list = await service.getTemplates();
    const targetId = list[0].id;

    // Hide target template
    const hidden = await service.setTemplateHidden(targetId, true);
    expect(hidden.isHidden).toBe(true);

    // Default getTemplates() should exclude targetId
    const afterHide = await service.getTemplates();
    expect(afterHide.some((t) => t.id === targetId)).toBe(false);

    // getTemplates({ includeHidden: true }) should include targetId
    const withHidden = await service.getTemplates({ includeHidden: true });
    expect(withHidden.some((t) => t.id === targetId)).toBe(true);

    // Unhide target template
    const unhidden = await service.setTemplateHidden(targetId, false);
    expect(unhidden.isHidden).toBe(false);

    const afterUnhide = await service.getTemplates();
    expect(afterUnhide.some((t) => t.id === targetId)).toBe(true);
  });
});
