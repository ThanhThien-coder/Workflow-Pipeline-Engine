// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
import { ApiError } from '../../../services/http/ApiError'
import type { ProjectArtifact } from '../../../types/artifact.types'

/**
 * T2 (G4) — artifact lấy từ service, không có dữ liệu giả ở slice, không localStorage.
 * Mảng rỗng là kết quả hợp lệ; lỗi thì báo, không rơi về dữ liệu giả.
 */

function artifact(id: string, name: string, projectId = '19'): ProjectArtifact {
  return {
    id, projectId, name, title: name, type: 'OTHER_LINK', url: `https://example.com/${id}`,
    isInRepository: true, isPublicForGuest: false, createdAt: '2026-11-14',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('artifactsSlice', () => {
  let service: MockWorkflowService
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    localStorage.clear()
    service = new MockWorkflowService()
    store = createWorkflowStore(service)
  })

  it('khởi tạo rỗng, không có artifact giả', () => {
    expect(store.getState().artifacts.items).toEqual([])
    expect(store.getState().artifacts.status).toBe('idle')
  })

  it('dự án chưa có artifact: service trả [] thì danh sách rỗng (không phải 5 link giả)', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([])

    await store.getState().artifacts.loadArtifacts('19')

    expect(store.getState().artifacts.items).toEqual([])
    expect(store.getState().artifacts.status).toBe('ready')
  })

  it('tải lỗi: báo lỗi, danh sách rỗng, không rơi về dữ liệu giả', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockRejectedValue(
      new ApiError({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Lỗi máy chủ' }),
    )

    await store.getState().artifacts.loadArtifacts('19')

    expect(store.getState().artifacts.status).toBe('error')
    expect(store.getState().artifacts.error).toBe('Lỗi máy chủ')
    expect(store.getState().artifacts.items).toEqual([])
  })

  it('đổi dự án: xóa danh sách dự án cũ ngay, bỏ qua kết quả về muộn của dự án cũ', async () => {
    const slowOld = deferred<ProjectArtifact[]>()
    vi.spyOn(service, 'getProjectArtifacts').mockImplementation((id: string) =>
      id === '1' ? slowOld.promise : Promise.resolve([artifact('7', 'Link dự án 2', '2')]),
    )

    const loadOld = store.getState().artifacts.loadArtifacts('1')
    await store.getState().artifacts.loadArtifacts('2')
    slowOld.resolve([artifact('1', 'Link dự án 1', '1')])
    await loadOld

    expect(store.getState().artifacts.items.map((a) => a.name)).toEqual(['Link dự án 2'])
  })

  it('thêm: gọi service rồi thêm bản backend trả về (id thật) lên đầu', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([artifact('1', 'Cũ')])
    const create = vi.spyOn(service, 'createArtifact').mockResolvedValue(artifact('99', 'Figma'))
    await store.getState().artifacts.loadArtifacts('19')

    const created = await store.getState().artifacts.addArtifact('19', { name: 'Figma', url: 'https://figma.com/x' })

    expect(create).toHaveBeenCalledWith('19', { name: 'Figma', url: 'https://figma.com/x', isInRepository: true })
    expect(created.id).toBe('99')
    expect(store.getState().artifacts.items.map((a) => a.id)).toEqual(['99', '1'])
  })

  it('thêm lỗi: ném lỗi, danh sách giữ nguyên', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([])
    vi.spyOn(service, 'createArtifact').mockRejectedValue(new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Không có quyền' }))
    await store.getState().artifacts.loadArtifacts('19')

    await expect(store.getState().artifacts.addArtifact('19', { name: 'X', url: 'https://x.com' })).rejects.toMatchObject({ status: 403 })
    expect(store.getState().artifacts.items).toEqual([])
  })

  it('xóa: gọi service xong mới bỏ khỏi danh sách; lỗi thì giữ nguyên', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([artifact('1', 'A'), artifact('2', 'B')])
    const remove = vi.spyOn(service, 'deleteArtifact')
    await store.getState().artifacts.loadArtifacts('19')

    remove.mockRejectedValueOnce(new ApiError({ status: 500, code: 'X', message: 'Lỗi' }))
    await expect(store.getState().artifacts.removeArtifact('19', '1')).rejects.toBeTruthy()
    expect(store.getState().artifacts.items).toHaveLength(2)

    remove.mockResolvedValueOnce(undefined)
    await store.getState().artifacts.removeArtifact('19', '1')
    expect(remove).toHaveBeenLastCalledWith('19', '1')
    expect(store.getState().artifacts.items.map((a) => a.id)).toEqual(['2'])
  })

  it('không ghi localStorage', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([])
    vi.spyOn(service, 'createArtifact').mockResolvedValue(artifact('99', 'Figma'))
    await store.getState().artifacts.loadArtifacts('19')
    await store.getState().artifacts.addArtifact('19', { name: 'Figma', url: 'https://figma.com/x' })

    expect(Object.keys(localStorage).filter((k) => k.startsWith('wpe_artifacts_'))).toEqual([])
  })

  it('mở, đóng, bật/tắt drawer', () => {
    expect(store.getState().artifacts.isDrawerOpen).toBe(false)
    store.getState().artifacts.openDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(true)
    store.getState().artifacts.closeDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(false)
    store.getState().artifacts.toggleDrawer()
    expect(store.getState().artifacts.isDrawerOpen).toBe(true)
  })

  it('bật/tắt hiển thị cho khách: gọi API và hoàn tác nếu lỗi', async () => {
    vi.spyOn(service, 'getProjectArtifacts').mockResolvedValue([artifact('1', 'Spec')])
    const toggle = vi.spyOn(service, 'setArtifactGuestVisibility')
    await store.getState().artifacts.loadArtifacts('19')

    toggle.mockResolvedValueOnce({ ...artifact('1', 'Spec'), isPublicForGuest: true })
    await store.getState().artifacts.setGuestVisibility('19', '1', true)
    expect(toggle).toHaveBeenCalledWith('19', '1', true)
    expect(store.getState().artifacts.items[0].isPublicForGuest).toBe(true)

    toggle.mockRejectedValueOnce(new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Denied' }))
    await expect(store.getState().artifacts.setGuestVisibility('19', '1', false)).rejects.toMatchObject({
      status: 403,
    })
    expect(store.getState().artifacts.items[0].isPublicForGuest).toBe(true)
  })
})
