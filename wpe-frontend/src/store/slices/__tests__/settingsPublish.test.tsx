// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/MockWorkflowService'
// settingsSlice gọi workflowService lấy thẳng từ container (không qua service truyền vào store), nên spy trên đó
import { workflowService } from '../../../services/container'
import { GeneralSettingsSection } from '../../../components/settings/GeneralSettingsSection'
import { KahnCycleModal } from '../../../components/settings/KahnCycleModal'
import type { ProjectSettingsDto } from '../../../types/settings.types'

/**
 * B6 — Xuất bản trên giao diện: trạng thái cho phép xuất bản, danh sách node gây vòng lặp và modal chu trình.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('B6: settingsSlice.publishProject', () => {
  it('chu trình mà máy chủ không gửi danh sách node: KHÔNG hiện mã node bịa (WPE-009, WPE-014…)', async () => {
    const service = new MockWorkflowService()
    const store = createWorkflowStore(service)
    await store.getState().settings.loadSettings('1')
    vi.spyOn(workflowService, 'publishPipeline').mockResolvedValue({ success: false, cycleDetected: true })

    const ok = await store.getState().settings.publishProject()

    expect(ok).toBe(false)
    const errors = store.getState().settings.kahnCycleErrors
    expect(errors).not.toBeNull() // vẫn mở modal
    expect(errors).not.toContain('WPE-009')
    expect(errors).not.toContain('WPE-014')
  })

  it('chu trình: danh sách node lấy đúng từ máy chủ (cycleNodes của 422)', async () => {
    const service = new MockWorkflowService()
    const store = createWorkflowStore(service)
    await store.getState().settings.loadSettings('1')
    vi.spyOn(workflowService, 'publishPipeline').mockResolvedValue({
      success: false, cycleDetected: true, violatingNodeIds: ['WPE-001', 'WPE-003'],
    })

    await store.getState().settings.publishProject()

    expect(store.getState().settings.kahnCycleErrors).toEqual(['WPE-001', 'WPE-003'])
    expect(store.getState().settings.settings?.status).toBe('DRAFT')
  })

  it('máy chủ từ chối 409 (ví dụ đã ACTIVE): hiện toast đúng câu của máy chủ, không đổi trạng thái', async () => {
    const service = new MockWorkflowService()
    const store = createWorkflowStore(service)
    await store.getState().settings.loadSettings('1')
    vi.spyOn(workflowService, 'publishPipeline').mockRejectedValue(
      Object.assign(new Error('Chỉ xuất bản được dự án đang ở trạng thái DRAFT hoặc PLANNING. Trạng thái hiện tại: ACTIVE.'), {
        status: 409, code: 'INVALID_PROJECT_STATUS',
      }),
    )

    const ok = await store.getState().settings.publishProject()

    expect(ok).toBe(false)
    expect(store.getState().settings.toast).toContain('DRAFT hoặc PLANNING')
    expect(store.getState().settings.settings?.status).toBe('DRAFT')
    expect(store.getState().settings.kahnCycleErrors).toBeNull()
  })

  it('xuất bản đúng dự án đang mở (id từ trang), không lấy id của settings (đang là mock, luôn "1")', async () => {
    const service = new MockWorkflowService()
    const store = createWorkflowStore(service)
    await store.getState().settings.loadSettings('5') // mock trả settings id '1' bất kể yêu cầu dự án nào
    const spy = vi.spyOn(workflowService, 'publishPipeline').mockResolvedValue({ success: true, newStatus: 'ACTIVE' })

    await store.getState().settings.publishProject('5')

    expect(spy).toHaveBeenCalledWith('5')
  })

  it('không truyền id thì vẫn dùng id của settings như cũ (tương thích chỗ gọi cũ)', async () => {
    const service = new MockWorkflowService()
    const store = createWorkflowStore(service)
    await store.getState().settings.loadSettings('1')
    const spy = vi.spyOn(workflowService, 'publishPipeline').mockResolvedValue({ success: true, newStatus: 'ACTIVE' })

    await store.getState().settings.publishProject()

    expect(spy).toHaveBeenCalledWith('1')
  })
})

function projectWith(status: string): ProjectSettingsDto {
  return {
    // PLANNING chưa có trong ProjectStatus của settings.types nhưng backend có trả, nên ép kiểu
    id: '5', name: 'B6 thử', description: '', status: status as ProjectSettingsDto['status'], ownerId: '2', myRole: 'OWNER',
    createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z',
  }
}

describe('B6: nút Publish theo trạng thái dự án (khớp backend B4: DRAFT hoặc PLANNING)', () => {
  const noop = async () => true

  it.each(['DRAFT', 'PLANNING'] as const)('dự án %s: owner thấy nút Publish Pipeline', (status) => {
    render(<GeneralSettingsSection settings={projectWith(status)} myRole="OWNER" onSave={noop} onPublish={noop} />)
    expect(screen.queryByRole('button', { name: /publish pipeline/i })).not.toBeNull()
  })

  it.each(['ACTIVE', 'ARCHIVED'] as const)('dự án %s: không có nút Publish Pipeline', (status) => {
    render(<GeneralSettingsSection settings={projectWith(status)} myRole="OWNER" onSave={noop} onPublish={noop} />)
    expect(screen.queryByRole('button', { name: /publish pipeline/i })).toBeNull()
  })

  it('không phải owner: không có nút Publish Pipeline', () => {
    render(<GeneralSettingsSection settings={projectWith('DRAFT')} myRole="COLLABORATOR" onSave={noop} onPublish={noop} />)
    expect(screen.queryByRole('button', { name: /publish pipeline/i })).toBeNull()
  })
})

describe('B6: KahnCycleModal', () => {
  it('ghi đúng mã 422 (không phải HTTP 400) và liệt kê từng mã node', () => {
    render(<KahnCycleModal violatingNodeIds={['WPE-001', 'WPE-002', 'WPE-003']} onClose={() => {}} />)
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('HTTP 400')
    expect(text).toContain('422')
    for (const code of ['WPE-001', 'WPE-002', 'WPE-003']) {
      expect(screen.getByText(code)).toBeTruthy()
    }
  })

  it('danh sách rỗng (máy chủ không gửi mã) vẫn hiện modal kèm lời giải thích', () => {
    render(<KahnCycleModal violatingNodeIds={[]} onClose={() => {}} />)
    expect(document.body.textContent).toContain('422')
  })

  it('null thì không hiện gì (modal đang đóng)', () => {
    const { container } = render(<KahnCycleModal violatingNodeIds={null} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
