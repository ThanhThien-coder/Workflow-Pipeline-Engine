// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { WorkflowArtifactsDrawer } from '../WorkflowArtifactsDrawer'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { workflowService } from '../../../services/container'
import { ApiError } from '../../../services/http/ApiError'
import type { ProjectArtifact } from '../../../types/artifact.types'

function makeArtifact(over: Partial<ProjectArtifact> = {}): ProjectArtifact {
  return {
    id: 'art-1',
    projectId: '7',
    name: 'Architecture Spec',
    title: 'Architecture Spec',
    type: 'DOCS',
    url: 'https://docs.example.com/spec',
    isInRepository: true,
    isPublicForGuest: true,
    createdAt: 'Nov 20, 2026',
    ...over,
  }
}

function seedRole(myRole: 'OWNER' | 'MANAGER' | 'COLLABORATOR' | 'VIEWER') {
  useWorkflowStore.setState((st) => ({
    currentProjectId: '7',
    settings: { ...st.settings, settings: null },
    project: {
      ...st.project,
      info: {
        id: '7',
        name: 'Demo',
        description: '',
        status: 'ACTIVE',
        ownerId: '1',
        myRole,
        createdAt: '',
        updatedAt: '',
      },
    },
  }))
}

describe('WorkflowArtifactsDrawer — công tắc Visible to guests', () => {
  beforeEach(() => {
    useWorkflowStore.setState((st) => ({
      currentProjectId: '7',
      artifacts: {
        ...st.artifacts,
        projectId: '7',
        items: [makeArtifact()],
        status: 'ready',
        error: null,
      },
    }))
    vi.spyOn(workflowService, 'getProjectArtifacts').mockResolvedValue([makeArtifact()])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useWorkflowStore.setState((st) => ({
      project: { ...st.project, info: null },
    }))
  })

  it('OWNER và MANAGER thấy công tắc; COLLABORATOR và VIEWER không thấy', () => {
    seedRole('OWNER')
    const { rerender } = render(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Visible to guests/i })).toBeDefined()

    seedRole('MANAGER')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Visible to guests/i })).toBeDefined()

    seedRole('COLLABORATOR')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Visible to guests/i })).toBeNull()

    seedRole('VIEWER')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Visible to guests/i })).toBeNull()
  })

  it('bấm công tắc gọi đúng API; nếu API lỗi thì hoàn tác trạng thái và báo lỗi', async () => {
    seedRole('OWNER')
    const showToast = vi.fn()
    useWorkflowStore.setState((st) => ({ ui: { ...st.ui, showToast } }))

    const spy = vi
      .spyOn(workflowService, 'setArtifactGuestVisibility')
      .mockResolvedValueOnce(makeArtifact({ isPublicForGuest: false }))
      .mockRejectedValueOnce(new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'Not allowed' }))

    render(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)

    const toggleBtn = screen.getByRole('button', { name: /Visible to guests: Architecture Spec/i })
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true')
    expect(toggleBtn.textContent).toContain('Shown to guests')

    // Lần 1: tắt thành công
    fireEvent.click(toggleBtn)
    await waitFor(() => expect(spy).toHaveBeenCalledWith('7', 'art-1', false))
    await waitFor(() => expect(toggleBtn.getAttribute('aria-pressed')).toBe('false'))
    expect(toggleBtn.textContent).toContain('Hidden from guests')

    // Lần 2: bật lại nhưng API lỗi -> hoàn tác về false và hiện toast lỗi
    fireEvent.click(toggleBtn)
    await waitFor(() => expect(spy).toHaveBeenCalledWith('7', 'art-1', true))
    await waitFor(() => expect(toggleBtn.getAttribute('aria-pressed')).toBe('false'))
    expect(toggleBtn.textContent).toContain('Hidden from guests')
    expect(showToast).toHaveBeenCalledWith('Not allowed')
  })
})

describe('WorkflowArtifactsDrawer — sửa tên và link', () => {
  function seedUser(id: string) {
    useWorkflowStore.setState((st) => ({
      auth: { ...st.auth, currentUser: { ...(st.auth.currentUser ?? {}), id } as typeof st.auth.currentUser },
    }))
  }

  beforeEach(() => {
    const items = [makeArtifact({ uploadedBy: '3' }), makeArtifact({ id: 'art-2', name: 'Other PR', title: 'Other PR', uploadedBy: '9' })]
    useWorkflowStore.setState((st) => ({
      currentProjectId: '7',
      artifacts: { ...st.artifacts, projectId: '7', items, status: 'ready', error: null },
    }))
    vi.spyOn(workflowService, 'getProjectArtifacts').mockResolvedValue(items)
    seedUser('3')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useWorkflowStore.setState((st) => ({
      project: { ...st.project, info: null },
      auth: { ...st.auth, currentUser: null },
    }))
  })

  it('OWNER/MANAGER sửa được mọi link; COLLABORATOR chỉ link mình đăng; VIEWER không sửa', () => {
    seedRole('OWNER')
    const { rerender } = render(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Edit /i })).toHaveLength(2)

    seedRole('MANAGER')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Edit /i })).toHaveLength(2)

    seedRole('COLLABORATOR')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit Architecture Spec' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Edit Other PR' })).toBeNull()

    seedRole('VIEWER')
    rerender(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    expect(screen.queryAllByRole('button', { name: /^Edit /i })).toHaveLength(0)
  })

  it('lưu thì gọi API với tên đã cắt khoảng trắng và link có https, rồi thay bản trong danh sách', async () => {
    seedRole('OWNER')
    const spy = vi
      .spyOn(workflowService, 'updateArtifact')
      .mockResolvedValue(makeArtifact({ name: 'Spec v2', title: 'Spec v2', url: 'https://docs.example.com/v2', uploadedBy: '3' }))

    render(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Architecture Spec' }))

    fireEvent.change(screen.getByLabelText('Link name'), { target: { value: '  Spec v2 ' } })
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'docs.example.com/v2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(spy).toHaveBeenCalledWith('7', 'art-1', { name: 'Spec v2', url: 'https://docs.example.com/v2' }))
    await waitFor(() => expect(screen.queryByLabelText('Link name')).toBeNull())
    expect(screen.getByText('Spec v2')).toBeDefined()
  })

  it('link sai thì báo lỗi, không gọi API; API lỗi thì giữ form và hiện lỗi; Cancel thì bỏ sửa', async () => {
    seedRole('OWNER')
    const spy = vi
      .spyOn(workflowService, 'updateArtifact')
      .mockRejectedValue(new ApiError({ status: 403, code: 'ACCESS_DENIED', message: 'You can only edit artifacts you added.' }))

    render(<WorkflowArtifactsDrawer projectId="7" isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Architecture Spec' }))

    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'not a link' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toContain("isn't valid")
    expect(spy).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://docs.example.com/v3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('You can only edit artifacts you added.'))
    expect(screen.getByLabelText('Link name')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Link name')).toBeNull()
    expect(screen.getByText('Architecture Spec')).toBeDefined()
  })
})
