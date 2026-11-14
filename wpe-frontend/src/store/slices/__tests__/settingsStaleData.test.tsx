// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { createWorkflowStore, useWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
// settingsSlice gọi workflowService lấy thẳng từ container, nên spy trên đó
import { workflowService } from '../../../services/container'
import { SettingsView } from '../../../components/views/SettingsView'
import type { ProjectSettingsDto } from '../../../types/settings.types'

/**
 * Lỗi phát hiện khi kiểm tay FC1–FC5 (14/11):
 * 1. Đổi tài khoản rồi mở lại Settings đúng dự án cũ → vẫn hiện quyền của tài khoản trước (read-only), F5 mới đúng.
 * 2. System log hiện dữ liệu cũ/trống, F5 mới đúng.
 * Nguyên nhân: SettingsView chỉ tải khi status 'idle' hoặc khác dự án; kết quả tải cũ trả về muộn vẫn ghi đè.
 */

function settingsDto(id: string, myRole: ProjectSettingsDto['myRole']): ProjectSettingsDto {
  return {
    id,
    name: `Dự án ${id}`,
    description: '',
    status: 'DRAFT',
    ownerId: '2',
    myRole,
    createdAt: '2026-11-14T00:00:00Z',
    updatedAt: '2026-11-14T00:00:00Z',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Các API phụ của loadSettings trả rỗng, chỉ getProjectSettings do từng test điều khiển. */
function stubSideCalls() {
  vi.spyOn(workflowService, 'getProjectMembersDetailed').mockResolvedValue([])
  vi.spyOn(workflowService, 'getProjectAuditLogs').mockResolvedValue([])
  // Hai phương thức này là tùy chọn trong IWorkflowService nên kiểu của spyOn không suy ra được
  const optional = workflowService as unknown as Record<string, () => Promise<unknown[]>>
  for (const method of ['getProjectPendingInvitations', 'getProjectMemberHistory']) {
    if (typeof optional[method] === 'function') {
      vi.spyOn(optional, method).mockResolvedValue([])
    }
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('settingsSlice.loadSettings: không dùng dữ liệu cũ', () => {
  it('kết quả của lần tải cũ trả về muộn không ghi đè lần tải mới', async () => {
    const store = createWorkflowStore(new MockWorkflowService())
    stubSideCalls()
    const slow = deferred<ProjectSettingsDto>()
    vi.spyOn(workflowService, 'getProjectSettings').mockImplementation((projectId: string) =>
      projectId === '1' ? slow.promise : Promise.resolve(settingsDto('2', 'OWNER')),
    )

    const first = store.getState().settings.loadSettings('1')
    await store.getState().settings.loadSettings('2')
    slow.resolve(settingsDto('1', 'VIEWER'))
    await first

    expect(store.getState().settings.settings?.id).toBe('2')
    expect(store.getState().settings.settings?.myRole).toBe('OWNER')
    expect(store.getState().settings.status).toBe('ready')
  })

  it('đổi sang dự án khác: xóa dữ liệu và bộ lọc nhật ký của dự án cũ ngay khi bắt đầu tải', async () => {
    const store = createWorkflowStore(new MockWorkflowService())
    await store.getState().settings.loadSettings('1')
    store.getState().settings.setAuditFilter('Governance')
    store.getState().settings.setSearchQuery('abc')
    expect(store.getState().settings.auditLogs.length).toBeGreaterThan(0)

    stubSideCalls()
    const pending = deferred<ProjectSettingsDto>()
    vi.spyOn(workflowService, 'getProjectSettings').mockReturnValue(pending.promise)
    const loading = store.getState().settings.loadSettings('2')

    const s = store.getState().settings
    expect(s.status).toBe('loading')
    expect(s.settings).toBeNull()
    expect(s.auditLogs).toEqual([])
    expect(s.members).toEqual([])
    expect(s.auditFilter).toBe('All Events')
    expect(s.searchQuery).toBe('')

    pending.resolve(settingsDto('2', 'OWNER'))
    await loading
    expect(store.getState().settings.settings?.id).toBe('2')
  })

  it('đăng xuất trong lúc đang tải: kết quả trả về sau không ghi vào phiên mới', async () => {
    const store = createWorkflowStore(new MockWorkflowService())
    stubSideCalls()
    const pending = deferred<ProjectSettingsDto>()
    vi.spyOn(workflowService, 'getProjectSettings').mockReturnValue(pending.promise)

    const loading = store.getState().settings.loadSettings('2')
    await store.getState().auth.logout()
    pending.resolve(settingsDto('2', 'VIEWER'))
    await loading

    expect(store.getState().settings.settings).toBeNull()
    expect(store.getState().settings.status).toBe('idle')
  })
})

describe('SettingsView: mở lại đúng dự án cũ vẫn tải lại', () => {
  it('store đang giữ dự án 2 với quyền VIEWER cũ → mở Settings dự án 2 thì gọi lại API và hiện quyền mới', async () => {
    stubSideCalls()
    const getSettings = vi
      .spyOn(workflowService, 'getProjectSettings')
      .mockResolvedValue(settingsDto('2', 'OWNER'))
    useWorkflowStore.setState((state) => ({
      settings: { ...state.settings, settings: settingsDto('2', 'VIEWER'), status: 'ready' },
    }))

    render(<SettingsView projectId="2" />)

    await waitFor(() => expect(getSettings).toHaveBeenCalledWith('2'))
    await waitFor(() => expect(useWorkflowStore.getState().settings.settings?.myRole).toBe('OWNER'))
  })
})
