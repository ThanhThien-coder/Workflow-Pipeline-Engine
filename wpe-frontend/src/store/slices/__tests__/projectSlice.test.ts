import { describe, it, expect, vi } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import { ApiError } from '../../../services/http/ApiError'
import type { ProjectSettingsDto } from '../../../types/settings.types'
import type { UserSummary } from '../../../types/kanban.types'

/** T1 (G5) — thông tin dự án đang mở + thành viên thật, tải một lần khi vào dự án. */

function info(id: string, name: string): ProjectSettingsDto {
  return { id, name, description: '', status: 'DRAFT', ownerId: '9', myRole: 'OWNER', createdAt: '', updatedAt: '' }
}

function member(id: string, name: string): UserSummary {
  return { id, name, roleTitle: 'OWNER', initials: name.slice(0, 2).toUpperCase(), avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0 }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('projectSlice.loadProject', () => {
  it('tải thông tin dự án và thành viên thật', async () => {
    const service = new MockWorkflowService()
    vi.spyOn(service, 'getProjectSettings').mockResolvedValue(info('19', 'b'))
    vi.spyOn(service, 'getProjectMembers').mockResolvedValue([member('9', 'a')])
    const store = createWorkflowStore(service)

    await store.getState().project.loadProject('19')

    const project = store.getState().project
    expect(project.status).toBe('ready')
    expect(project.projectId).toBe('19')
    expect(project.info?.name).toBe('b')
    expect(project.members.map((m) => m.name)).toEqual(['a'])
  })

  it('backend lỗi thì báo lỗi, không có dữ liệu giả', async () => {
    const service = new MockWorkflowService()
    vi.spyOn(service, 'getProjectSettings').mockRejectedValue(
      new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Không có quyền' }),
    )
    vi.spyOn(service, 'getProjectMembers').mockResolvedValue([member('9', 'a')])
    const store = createWorkflowStore(service)

    await store.getState().project.loadProject('19')

    const project = store.getState().project
    expect(project.status).toBe('error')
    expect(project.error).toBe('Không có quyền')
    expect(project.info).toBeNull()
    expect(project.members).toEqual([])
  })

  it('chuyển dự án: xóa dữ liệu dự án cũ ngay, bỏ qua kết quả về muộn của dự án cũ', async () => {
    const service = new MockWorkflowService()
    const slowOld = deferred<ProjectSettingsDto>()
    vi.spyOn(service, 'getProjectSettings').mockImplementation((id: string) =>
      id === '1' ? slowOld.promise : Promise.resolve(info('2', 'Dự án 2')),
    )
    vi.spyOn(service, 'getProjectMembers').mockResolvedValue([member('9', 'a')])
    const store = createWorkflowStore(service)

    const loadOld = store.getState().project.loadProject('1')
    await store.getState().project.loadProject('2')
    slowOld.resolve(info('1', 'Dự án 1'))
    await loadOld

    expect(store.getState().project.projectId).toBe('2')
    expect(store.getState().project.info?.name).toBe('Dự án 2')
  })
})
