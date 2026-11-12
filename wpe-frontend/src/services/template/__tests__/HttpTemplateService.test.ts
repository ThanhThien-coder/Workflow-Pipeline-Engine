// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpTemplateService } from '../HttpTemplateService';
import { ApiError } from '../../http/ApiError';
import type {
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  GraphDataPayload,
} from '../../../types/template.types';

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Call = { method: string; url: string; body: unknown };

const DUMMY_GRAPH: GraphDataPayload = {
  schemaVersion: 2,
  phases: [],
  phaseEdges: [],
  nodes: [],
  edges: [],
  metadata: { version: '1.0' },
};

const DUMMY_CREATE_DTO: CreateTemplateRequestDto = {
  name: 'Sample Template',
  category: 'Software Engineering',
  isSystemStandard: true,
  graphData: DUMMY_GRAPH,
};

describe('HttpTemplateService unit tests', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let calls: Call[];
  let service: HttpTemplateService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    calls = [];
    service = new HttpTemplateService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("getTemplates({category:'DevOps', search:'ci'}) gọi đúng URL có query", async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(200, []);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await service.getTemplates({ category: 'DevOps' as any, search: 'ci' });

    expect(result).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/templates?');
    expect(calls[0].url).toContain('category=DevOps');
    expect(calls[0].url).toContain('search=ci');
  });

  it("createTemplate khi server trả 422 {error:'CYCLE_DETECTED', cycleNodes:['n1','n2']} → ném ApiError có status 422 và cycleNodes ['n1','n2']", async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(422, {
        status: 422,
        error: 'CYCLE_DETECTED',
        message: 'Đồ thị có chu trình lặp',
        cycleNodes: ['n1', 'n2'],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.createTemplate(DUMMY_CREATE_DTO)).rejects.toMatchObject({
      status: 422,
      code: 'CYCLE_DETECTED',
      cycleNodes: ['n1', 'n2'],
    });

    let caught: unknown;
    try {
      await service.createTemplate(DUMMY_CREATE_DTO);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).cycleNodes).toEqual(['n1', 'n2']);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/templates');
  });

  it("updateTemplate khi 403 → ApiError status 403 code 'ACCESS_DENIED'", async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(403, {
        status: 403,
        error: 'ACCESS_DENIED',
        message: 'Chỉ quản trị viên mới có quyền cập nhật template',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const updateDto: UpdateTemplateRequestDto = { ...DUMMY_CREATE_DTO, name: 'Updated' };

    await expect(service.updateTemplate('tpl-1', updateDto)).rejects.toMatchObject({
      status: 403,
      code: 'ACCESS_DENIED',
    });

    let caught: unknown;
    try {
      await service.updateTemplate('tpl-1', updateDto);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(403);
    expect((caught as ApiError).code).toBe('ACCESS_DENIED');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toMatch(/\/templates\/tpl-1$/);
  });

  it("saveProjectAsTemplate('7', {name:'x'}) gọi POST /projects/7/save-as-template", async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(201, {
        id: 'tpl-from-p7',
        name: 'x',
        category: 'General',
        isSystemStandard: false,
        graphData: DUMMY_GRAPH,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await service.saveProjectAsTemplate('7', { name: 'x' });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/projects\/7\/save-as-template$/);
    expect(calls[0].body).toEqual({ name: 'x' });
    expect(saved.id).toBe('tpl-from-p7');
    expect(saved.name).toBe('x');
  });

  it('deleteTemplate 204 → không lỗi', async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.deleteTemplate('tpl-del-1')).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toMatch(/\/templates\/tpl-del-1$/);
  });

  it('getTemplateById gọi đúng GET /templates/:id', async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: undefined,
      });
      return jsonResponse(200, { id: 'tpl-100', name: 'Detail Tpl', graphData: DUMMY_GRAPH });
    });
    vi.stubGlobal('fetch', fetchMock);

    const detail = await service.getTemplateById('tpl-100');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toMatch(/\/templates\/tpl-100$/);
    expect(detail.id).toBe('tpl-100');
  });

  it('validateGraph gọi POST /templates/validate và map đúng kết quả vi phạm', async () => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse(200, {
        valid: false,
        visitedCount: 1,
        totalCount: 3,
        violations: [
          { scope: 'PHASE', phaseId: 'p1', nodeIds: ['p1', 'p2'] },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await service.validateGraph(DUMMY_GRAPH);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/templates\/validate$/);
    expect(res.valid).toBe(false);
    expect(res.violations).toHaveLength(1);
    expect(res.violations[0].scope).toBe('PHASE');
    expect(res.violations[0].nodeIds).toEqual(['p1', 'p2']);
  });
});
