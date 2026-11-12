// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceMembersSection } from '../WorkspaceMembersSection'
import type { ProjectInvitationDto, ProjectMemberDetail } from '../../../types/settings.types'

describe('WorkspaceMembersSection Component', () => {
  const mockMember: ProjectMemberDetail = {
    userId: 'usr-1',
    username: 'alex.kim',
    email: 'alex@example.com',
    role: 'OWNER',
    joinedAt: new Date().toISOString(),
    activeNodeCount: 2,
    avatarClass: 'bg-indigo-500',
    initials: 'AK',
  }

  const mockPendingInvitations: ProjectInvitationDto[] = [
    {
      id: 'inv-active',
      projectId: '1',
      projectName: 'Test Project',
      inviterId: 'usr-1',
      inviterName: 'Alex Kim',
      inviteeEmail: 'active@example.com',
      role: 'COLLABORATOR',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // future
    },
    {
      id: 'inv-expired',
      projectId: '1',
      projectName: 'Test Project',
      inviterId: 'usr-1',
      inviterName: 'Alex Kim',
      inviteeEmail: 'expired@example.com',
      role: 'VIEWER',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 100000000).toISOString(),
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // past
    },
  ]

  it('renders pending invitations with "Đã hết hạn" for overdue invitation and keeps revoke button', () => {
    const handleRevoke = vi.fn()

    render(
      <WorkspaceMembersSection
        members={[mockMember]}
        pendingInvitations={mockPendingInvitations}
        simulatedRole="OWNER"
        onOpenInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onPromptDemote={vi.fn()}
        onPromptKick={vi.fn()}
        onRevokeInvitation={handleRevoke}
      />
    )

    // Check that both invitations are rendered
    expect(screen.getByText('active@example.com')).toBeDefined()
    expect(screen.getByText('expired@example.com')).toBeDefined()

    // Check that expired invitation has "Đã hết hạn"
    expect(screen.getByText('Đã hết hạn')).toBeDefined()

    // Revoke buttons exist for both pending invitations (2 revoke buttons in pending list)
    const revokeButtons = screen.getAllByRole('button', { name: /Revoke/i })
    expect(revokeButtons.length).toBe(2)
  })
})
