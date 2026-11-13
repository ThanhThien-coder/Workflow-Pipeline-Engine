// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpAdminService } from '../HttpAdminService';
import { ApiError } from '../../http/ApiError';

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Call = { method: string; url: string; body: unknown; headers: Record<string, string> };

const SARAH_API = {
  id: '3',
  username: 'sarah.chen',
  name: 'Sarah Chen',
  maskedEmail: 's***@pipeline.engine',
  role: 'USER',
  workspaceCount: 2,
  lastLoginAt: null,
  maskedIp: null,
  status: 'ACTIVE',
};

const WS_API = {
  id: '10',
  name: 'Core Banking Pipeline',
  ownerId: '2',
  ownerName: 'Alex Kim',
  status: 'ACTIVE',
  memberCount: 4,
  nodeCount: 6,
  updatedAt: '2026-11-01T10:00:00Z',
};

describe('HttpAdminService (A6) gọi API admin thật', () => {
  let calls: Call[];
  let service: HttpAdminService;

  function stubFetch(status: number, body?: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          method: init?.method ?? 'GET',
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return jsonResponse(status, body);
      })
    );
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('wpe_auth_token', 'jwt-admin');
    calls = [];
    service = new HttpAdminService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('getUsers gửi query/status, kèm Bearer và map role/status/ngày về kiểu của UI', async () => {
    stubFetch(200, [SARAH_API, { ...SARAH_API, id: '1', name: 'Admin', role: 'ADMIN', status: 'SUSPENDED' }]);

    const users = await service.getUsers('sarah', 'ACTIVE');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toMatch(/\/admin\/users\?query=sarah&status=ACTIVE$/);
    expect(calls[0].headers['Authorization']).toBe('Bearer jwt-admin');
    expect(users[0]).toMatchObject({
      id: '3',
      name: 'Sarah Chen',
      maskedEmail: 's***@pipeline.engine',
      role: 'STANDARD_USER',
      status: 'ACTIVE',
      workspaceCount: 2,
    });
    // Backend chưa có lastLoginAt/maskedIp: hiện gạch ngang, không hiện 1970-01-01
    expect(users[0].lastLoginAt).toBe('—');
    expect(users[0].maskedIp).toBe('—');
    expect(users[1].role).toBe('ADMIN');
    expect(users[1].status).toBe('SUSPENDED');
  });

  it("getUsers với status 'ALL' hoặc rỗng thì không gửi tham số", async () => {
    stubFetch(200, []);
    await service.getUsers('', 'ALL');
    expect(calls[0].url).toMatch(/\/admin\/users$/);
  });

  it('suspendUser gọi POST /admin/users/{id}/suspend với body { reason, durationDays }', async () => {
    stubFetch(200, { ...SARAH_API, status: 'SUSPENDED' });

    const res = await service.suspendUser({ userId: '3', reason: 'SECURITY_RISK', note: 'đăng nhập lạ', durationDays: 7 });

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/admin\/users\/3\/suspend$/);
    expect(calls[0].body).toEqual({ reason: 'SECURITY_RISK: đăng nhập lạ', durationDays: 7 });
    expect(res.status).toBe('SUSPENDED');
  });

  it('suspendUser bị từ chối CANNOT_SUSPEND_ADMIN thì ném ApiError giữ mã và lời nhắn của backend', async () => {
    stubFetch(403, {
      status: 403,
      error: 'CANNOT_SUSPEND_ADMIN',
      message: 'Không được khóa tài khoản có quyền ADMIN.',
      path: '/api/v1/admin/users/1/suspend',
    });

    const err = await service.suspendUser({ userId: '1', reason: 'OTHER' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe('CANNOT_SUSPEND_ADMIN');
    expect((err as ApiError).message).toBe('Không được khóa tài khoản có quyền ADMIN.');
  });

  it('user thường gọi API admin: ném ApiError 403 ACCESS_DENIED (không nuốt lỗi, không trả dữ liệu giả)', async () => {
    stubFetch(403, { status: 403, error: 'ACCESS_DENIED', message: 'Chỉ quản trị viên hệ thống (ADMIN) được dùng chức năng này.' });
    await expect(service.getUsers()).rejects.toMatchObject({ status: 403, code: 'ACCESS_DENIED' });
  });

  it('unbanUser gọi POST /admin/users/{id}/unban', async () => {
    stubFetch(200, SARAH_API);
    const res = await service.unbanUser('3');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/admin\/users\/3\/unban$/);
    expect(res.status).toBe('ACTIVE');
  });

  it('getWorkspaces map trạng thái dự án sang trạng thái của UI và giữ metadata', async () => {
    stubFetch(200, [
      WS_API,
      { ...WS_API, id: '11', status: 'ARCHIVED' },
      { ...WS_API, id: '12', status: 'DRAFT' },
    ]);

    const ws = await service.getWorkspaces();

    expect(calls[0].url).toMatch(/\/admin\/workspaces$/);
    expect(ws[0]).toMatchObject({
      id: '10',
      name: 'Core Banking Pipeline',
      ownerName: 'Alex Kim',
      nodeCount: 6,
      memberCount: 4,
      projectStatus: 'ACTIVE',
      status: 'RUNNING',
      updatedAt: '2026-11-01T10:00:00Z',
    });
    expect(ws[1].status).toBe('ARCHIVED');
    expect(ws[2].status).toBe('IDLE');
  });

  it('archiveWorkspace gọi POST /admin/workspaces/{id}/archive', async () => {
    stubFetch(200, { ...WS_API, status: 'ARCHIVED' });
    const res = await service.archiveWorkspace('10');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/admin\/workspaces\/10\/archive$/);
    expect(res.status).toBe('ARCHIVED');
  });

  it('KPI, xu hướng, phân bố vai trò, nhật ký bảo mật: chưa có API nên vẫn dùng mock, không gọi mạng', async () => {
    stubFetch(500, {});
    await service.getSystemKpis();
    await service.getAnalyticsTrends('7D');
    await service.getRoleDistribution();
    await service.getSecurityAuditLogs();
    expect(calls).toHaveLength(0);
  });
});
