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

    // Lần 1: tắt thành công
    fireEvent.click(toggleBtn)
    await waitFor(() => expect(spy).toHaveBeenCalledWith('7', 'art-1', false))
    await waitFor(() => expect(toggleBtn.getAttribute('aria-pressed')).toBe('false'))

    // Lần 2: bật lại nhưng API lỗi -> hoàn tác về false và hiện toast lỗi
    fireEvent.click(toggleBtn)
    await waitFor(() => expect(spy).toHaveBeenCalledWith('7', 'art-1', true))
    await waitFor(() => expect(toggleBtn.getAttribute('aria-pressed')).toBe('false'))
    expect(showToast).toHaveBeenCalledWith('Not allowed')
  })
})
