// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HttpWorkflowService, METHODS_STILL_MOCKED } from '../../HttpWorkflowService'
import { fetchProjectActivity } from '../activity'
import { SystemAuditLogSection } from '../../../../components/settings/SystemAuditLogSection'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('FC5 — Nhật ký hoạt động của dự án (Project Activity & Audit Logs)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getProjectAuditLogs không còn nằm trong METHODS_STILL_MOCKED', () => {
    const list: readonly string[] = METHODS_STILL_MOCKED
    expect(list).not.toContain('getProjectAuditLogs')
  })

  it('fetchProjectActivity gọi GET /projects/{id}/activity?limit=... và trả danh sách hoạt động', async () => {
    const sampleActivities = [
      {
        id: 'node-1-updated',
        type: 'TASK_STATUS_CHANGED',
        actorName: 'Alex Kim',
        message: 'Task WPE-001 (Database Schema 3NF) ở trạng thái DONE (lần cập nhật gần nhất)',
        targetCode: 'WPE-001',
        createdAt: '2026-11-13T10:00:00Z',
      },
      {
        id: 'member-2-joined',
        type: 'MEMBER_JOINED',
        actorName: 'Sarah Chen',
        message: 'Thành viên Sarah Chen (sarah.chen) đã tham gia dự án với vai trò COLLABORATOR',
        targetCode: null,
        createdAt: '2026-11-12T09:00:00Z',
      },
      {
        id: 'project-1-created',
        type: 'PROJECT_CREATED',
        actorName: 'Alex Kim',
        message: 'Đã tạo dự án "Core Banking Pipeline"',
        targetCode: null,
        createdAt: '2026-11-10T08:00:00Z',
      },
    ]
    fetchMock.mockResolvedValue(jsonResponse(200, sampleActivities))

    const res = await fetchProjectActivity('1', 10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:8080/api/v1/projects/1/activity?limit=10')
    expect(res).toHaveLength(3)
    expect(res[0].id).toBe('node-1-updated')
    expect(res[0].targetCode).toBe('WPE-001')
    expect(res[1].actorName).toContain('Sarah')
    expect(res[2].message.toLowerCase()).toContain('tạo dự án')
  })

  it('HttpWorkflowService.getProjectAuditLogs gọi API thật và ánh xạ sang AuditLogItem, lỗi 403 thì ném ApiError (không rơi về mock)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        {
          id: 'project-1-created',
          type: 'PROJECT_CREATED',
          actorName: 'Alex Kim',
          message: 'Đã tạo dự án "Core Banking Pipeline"',
          targetCode: null,
          createdAt: '2026-11-10T08:00:00Z',
        },
      ]),
    )

    const service = new HttpWorkflowService()
    const logs = await service.getProjectAuditLogs('1')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/v1/projects/1/activity?limit=50', expect.anything())
    expect(logs).toHaveLength(1)
    expect(logs[0].id).toBe('project-1-created')
    expect(logs[0].actor.name).toBe('Alex Kim')
    expect(logs[0].details).toContain('Đã tạo dự án')
    expect(logs[0].type).toBe('PROJECT_CREATED')

    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { status: 403, error: 'ACCESS_DENIED', message: 'Bạn không phải là thành viên của dự án này.' }),
    )
    await expect(service.getProjectAuditLogs('99')).rejects.toMatchObject({
      status: 403,
      code: 'ACCESS_DENIED',
    })
  })

  it('SystemAuditLogSection hiển thị icon, thời gian tương đối, ghi chú task, lọc theo loại, trạng thái rỗng và lỗi', () => {
    const onFilterChange = vi.fn()
    const onSearchChange = vi.fn()

    const logs = [
      {
        id: 'node-1-updated',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        actor: { userId: '2', name: 'Sarah Chen', role: 'COLLABORATOR' as const },
        action: 'TASK_STATUS_CHANGED' as const,
        details: 'Task WPE-002 cập nhật sang IN_PROGRESS',
        scope: 'Lifecycle' as const,
        type: 'TASK_STATUS_CHANGED',
        targetCode: 'WPE-002',
      },
      {
        id: 'project-1-created',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        actor: { userId: '1', name: 'Alex Kim', role: 'OWNER' as const },
        action: 'PROJECT_CREATED' as const,
        details: 'Đã tạo dự án "Core Banking Pipeline"',
        scope: 'Lifecycle' as const,
        type: 'PROJECT_CREATED',
      },
    ]

    const { container, rerender } = render(
      <SystemAuditLogSection
        logs={logs}
        filterScope="All Events"
        searchQuery=""
        onFilterScopeChange={onFilterChange}
        onSearchQueryChange={onSearchChange}
      />,
    )

    // Chú thích bắt buộc trên màn hình
    expect(screen.getByText('Task chỉ hiện lần cập nhật gần nhất (hệ thống không lưu lịch sử từng lần).')).toBeTruthy()
    // Hiển thị nội dung, targetCode, thời gian tương đối và icon SVG
    expect(screen.getByText(/Task WPE-002 cập nhật sang IN_PROGRESS/)).toBeTruthy()
    expect(screen.getByText('WPE-002')).toBeTruthy()
    expect(screen.getByText(/Đã tạo dự án/)).toBeTruthy()
    expect(screen.getByText('5 phút')).toBeTruthy()
    expect(screen.getByText('2 giờ')).toBeTruthy()
    expect(container.querySelectorAll('tbody svg').length).toBeGreaterThanOrEqual(2)

    // Đổi bộ lọc theo loại
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'TASK_STATUS_CHANGED' } })
    expect(onFilterChange).toHaveBeenCalledWith('TASK_STATUS_CHANGED')

    // Khi lọc theo TASK_STATUS_CHANGED thì chỉ hiện dòng task
    rerender(
      <SystemAuditLogSection
        logs={logs}
        filterScope="TASK_STATUS_CHANGED"
        searchQuery=""
        onFilterScopeChange={onFilterChange}
        onSearchQueryChange={onSearchChange}
      />,
    )
    expect(screen.getByText(/Task WPE-002 cập nhật sang IN_PROGRESS/)).toBeTruthy()
    expect(screen.queryByText(/Đã tạo dự án/)).toBeNull()

    // Trạng thái rỗng khi danh sách trống
    rerender(
      <SystemAuditLogSection
        logs={[]}
        filterScope="All Events"
        searchQuery=""
        onFilterScopeChange={onFilterChange}
        onSearchQueryChange={onSearchChange}
      />,
    )
    expect(screen.getByTestId('audit-log-empty')).toBeTruthy()

    // Trạng thái lỗi khi có lỗi (không rơi về mock)
    rerender(
      <SystemAuditLogSection
        logs={[]}
        filterScope="All Events"
        searchQuery=""
        onFilterScopeChange={onFilterChange}
        onSearchQueryChange={onSearchChange}
        error="Không thể tải nhật ký hoạt động"
      />,
    )
    expect(screen.getByTestId('audit-log-error')).toBeTruthy()
    expect(screen.getByText(/Không thể tải nhật ký hoạt động/)).toBeTruthy()
  })
})
