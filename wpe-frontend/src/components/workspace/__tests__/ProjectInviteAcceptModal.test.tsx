// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ProjectInviteAcceptModal } from '../ProjectInviteAcceptModal'
import { workflowService } from '../../../services/container'
import { useWorkflowStore } from '../../../store/useWorkflowStore'

describe('ProjectInviteAcceptModal Component', () => {
  const mockClose = vi.fn()
  const mockAccepted = vi.fn()
  const mockDeclined = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkflowStore.getState().ui.dismissToast()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders skeleton loader when fetching invitation details', async () => {
    // Deliberately delayed promise
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockReturnValueOnce(
      new Promise((resolve) => setTimeout(() => resolve({
        id: 'inv-99',
        projectId: '1',
        projectName: 'Alpha Test Pipeline',
        inviterId: 'usr-1',
        inviterName: 'Lead Architect',
        inviteeEmail: 'tester@pipeline.org',
        role: 'COLLABORATOR',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }), 200))
    )

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-99"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    // Skeleton loader should be rendered initially
    expect(screen.getByTestId('invitation-skeleton')).toBeDefined()

    // Once resolved, details are displayed
    await waitFor(() => {
      expect(screen.getByText('Alpha Test Pipeline')).toBeDefined()
      expect(screen.getByText('Lead Architect')).toBeDefined()
      expect(screen.getAllByText('COLLABORATOR').length).toBeGreaterThan(0)
    })
  })

  it('accepts invitation, triggers toast, calls workspace fetchProjects, and closes modal', async () => {
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockResolvedValueOnce({
      id: 'inv-100',
      projectId: '1',
      projectName: 'Alpha Test Pipeline',
      inviterId: 'usr-1',
      inviterName: 'Lead Architect',
      inviteeEmail: 'tester@pipeline.org',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })

    const acceptSpy = vi.spyOn(workflowService as any, 'acceptInvitation').mockResolvedValueOnce({ success: true, projectId: '1' })
    const fetchProjectsSpy = vi.spyOn(useWorkflowStore.getState().workspace as any, 'fetchProjects').mockResolvedValueOnce(undefined)

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-100"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alpha Test Pipeline')).toBeDefined()
    })

    const acceptBtn = screen.getByRole('button', { name: /Chấp nhận/i })
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith('inv-100')
      expect(fetchProjectsSpy).toHaveBeenCalled()
      expect(mockAccepted).toHaveBeenCalledWith('inv-100')
      expect(mockClose).toHaveBeenCalled()
      expect(useWorkflowStore.getState().ui.toast?.message).toBe('Tham gia dự án thành công!')
    })
  })

  it('declines invitation, triggers toast, and closes modal', async () => {
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockResolvedValueOnce({
      id: 'inv-101',
      projectId: '1',
      projectName: 'Beta Pipeline',
      inviterId: 'usr-2',
      inviterName: 'Sarah Chen',
      inviteeEmail: 'tester@pipeline.org',
      role: 'VIEWER',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })

    const rejectSpy = vi.spyOn(workflowService as any, 'rejectInvitation').mockResolvedValueOnce({ success: true })

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-101"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Beta Pipeline')).toBeDefined()
    })

    const declineBtn = screen.getByRole('button', { name: /Từ chối/i })
    fireEvent.click(declineBtn)

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith('inv-101')
      expect(mockDeclined).toHaveBeenCalledWith('inv-101')
      expect(mockClose).toHaveBeenCalled()
      expect(useWorkflowStore.getState().ui.toast?.message).toBe('Đã từ chối lời mời tham gia dự án.')
    })
  })

  it('handles API errors gracefully without freezing buttons', async () => {
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockResolvedValueOnce({
      id: 'inv-error',
      projectId: '1',
      projectName: 'Faulty Pipeline',
      inviterId: 'usr-1',
      inviterName: 'Lead Architect',
      inviteeEmail: 'tester@pipeline.org',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })

    vi.spyOn(workflowService as any, 'acceptInvitation').mockRejectedValueOnce(new Error('Network connection timeout'))

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-error"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Faulty Pipeline')).toBeDefined()
    })

    const acceptBtn = screen.getByRole('button', { name: /Chấp nhận/i }) as HTMLButtonElement
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(useWorkflowStore.getState().ui.toast?.message).toBe('Network connection timeout')
      // Submitting state should reset in finally block so button is not permanently disabled
      expect(acceptBtn.disabled).toBe(false)
    })
  })

  it('disables accept and decline buttons and shows expired message when invitation is expired', async () => {
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockResolvedValueOnce({
      id: 'inv-expired',
      projectId: '1',
      projectName: 'Expired Pipeline',
      inviterId: 'usr-1',
      inviterName: 'Lead Architect',
      inviteeEmail: 'tester@pipeline.org',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 100000000).toISOString(),
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    })

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-expired"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Expired Pipeline')).toBeDefined()
    })

    // Check for expired label containing "hết hạn"
    expect(screen.getByText(/hết hạn/i)).toBeDefined()

    // Accept button should be disabled
    const acceptBtn = screen.getByRole('button', { name: /Chấp nhận/i }) as HTMLButtonElement
    expect(acceptBtn.disabled).toBe(true)

    // Decline button should also be disabled
    const declineBtn = screen.getByRole('button', { name: /Từ chối/i }) as HTMLButtonElement
    expect(declineBtn.disabled).toBe(true)

    // Clicking accept should not trigger API call
    const acceptSpy = vi.spyOn(workflowService as any, 'acceptInvitation')
    fireEvent.click(acceptBtn)
    expect(acceptSpy).not.toHaveBeenCalled()
  })

  it('keeps accept and decline buttons enabled when invitation is still valid', async () => {
    vi.spyOn(workflowService as any, 'getInvitationDetail').mockResolvedValueOnce({
      id: 'inv-valid',
      projectId: '1',
      projectName: 'Valid Pipeline',
      inviterId: 'usr-1',
      inviterName: 'Lead Architect',
      inviteeEmail: 'tester@pipeline.org',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // 1 day in future
    })

    render(
      <ProjectInviteAcceptModal
        isOpen={true}
        invitationId="inv-valid"
        onClose={mockClose}
        onAccepted={mockAccepted}
        onDeclined={mockDeclined}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Valid Pipeline')).toBeDefined()
    })

    const acceptBtn = screen.getByRole('button', { name: /Chấp nhận/i }) as HTMLButtonElement
    expect(acceptBtn.disabled).toBe(false)

    const declineBtn = screen.getByRole('button', { name: /Từ chối/i }) as HTMLButtonElement
    expect(declineBtn.disabled).toBe(false)
  })
})
