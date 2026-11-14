// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'

// Test này cần chế độ API (mặc định test chạy mock), nên giả lập env trước khi nạp store và container.
vi.mock('../../../services/env', () => ({ isMockMode: false }))

import { createWorkflowStore } from '../../useWorkflowStore'
import { workflowService } from '../../../services/container'
import type { AuditLogItem, ProjectSettingsDto } from '../../../types/settings.types'

/**
 * Lỗi phát hiện khi kiểm tay (14/11): Remove tài nguyên dự án thì System log hiện dòng giả
 * "Alex Kim – Xóa tài nguyên" bất kể ai đang đăng nhập (addMockAuditLog ghi cứng người thực hiện).
 * Chế độ API: không chèn dòng giả, chỉ tải lại nhật ký thật của dự án đang mở.
 */

const settings: ProjectSettingsDto = {
  id: '2',
  name: 'test',
  description: '',
  status: 'DRAFT',
  ownerId: '2',
  myRole: 'OWNER',
  createdAt: '2026-11-14T00:00:00Z',
  updatedAt: '2026-11-14T00:00:00Z',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settingsSlice.addMockAuditLog ở chế độ API', () => {
  it('không chèn dòng giả "Alex Kim", tải lại nhật ký thật của dự án đang mở', async () => {
    const realLogs = [
      {
        id: 'activity-1',
        action: 'PROJECT_UPDATED',
        actor: { userId: '5', name: 'meomeo', role: 'COLLABORATOR' },
        details: 'Dòng thật từ backend',
        scope: 'Governance',
        timestamp: '2026-11-14T15:00:00Z',
      },
    ] as unknown as AuditLogItem[]
    const getLogs = vi.spyOn(workflowService, 'getProjectAuditLogs').mockResolvedValue(realLogs)

    const store = createWorkflowStore()
    store.setState((state) => ({ settings: { ...state.settings, settings, auditLogs: [], status: 'ready' } }))

    store.getState().settings.addMockAuditLog({
      action: 'RESOURCE_REMOVED',
      details: 'Removed project resource: API Documentation',
      scope: 'Governance',
    })

    // Không có dòng giả nào được chèn ngay
    expect(store.getState().settings.auditLogs.some((l) => l.actor?.name === 'Alex Kim')).toBe(false)

    await vi.waitFor(() => expect(store.getState().settings.auditLogs).toEqual(realLogs))
    expect(getLogs).toHaveBeenCalledWith('2')
  })

  it('chưa mở dự án nào: không gọi API, không chèn gì', () => {
    const getLogs = vi.spyOn(workflowService, 'getProjectAuditLogs').mockResolvedValue([])
    const store = createWorkflowStore()

    store.getState().settings.addMockAuditLog({ action: 'RESOURCE_ADDED', details: 'x', scope: 'Governance' })

    expect(getLogs).not.toHaveBeenCalled()
    expect(store.getState().settings.auditLogs).toEqual([])
  })
})
