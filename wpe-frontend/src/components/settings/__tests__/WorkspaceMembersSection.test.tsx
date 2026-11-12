// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WorkspaceMembersSection } from '../WorkspaceMembersSection'
import type { ProjectInvitationDto, ProjectMemberDetail, ProjectMemberHistoryItem } from '../../../types/settings.types'

describe('WorkspaceMembersSection Component', () => {
  afterEach(() => cleanup())

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

  it('khối lịch sử hiển thị "Đang tham gia" cho dòng active và ngày rời cho dòng inactive', () => {
    const mockHistory: ProjectMemberHistoryItem[] = [
      {
        userId: 'u1',
        username: 'active.user',
        fullName: 'Active User',
        role: 'COLLABORATOR',
        joinedAt: '2026-09-01T00:00:00Z',
        removedAt: null,
        active: true,
      },
      {
        userId: 'u2',
        username: 'inactive.user',
        fullName: 'Inactive User',
        role: 'VIEWER',
        joinedAt: '2026-08-01T00:00:00Z',
        removedAt: '2026-09-01T00:00:00Z',
        active: false,
      },
    ]

    render(
      <WorkspaceMembersSection
        members={[mockMember]}
        pendingInvitations={[]}
        memberHistory={mockHistory}
        simulatedRole="OWNER"
        onOpenInvite={vi.fn()}
        onRoleChange={vi.fn()}
        onPromptDemote={vi.fn()}
        onPromptKick={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Lịch sử thành viên/ })).toBeDefined()
    expect(screen.getByText('Đang tham gia')).toBeDefined()
    expect(screen.getByText('Active User (active.user)')).toBeDefined()
    expect(screen.getByText('Inactive User (inactive.user)')).toBeDefined()
  })

  it('chọn Chuyển quyền sở hữu (OWNER) hiện confirm và gọi onRoleChange với OWNER khi xác nhận', () => {
    const handleRoleChange = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const collaboratorMember: ProjectMemberDetail = {
      userId: 'usr-2',
      username: 'sarah.chen',
      email: 'sarah@example.com',
      role: 'COLLABORATOR',
      joinedAt: new Date().toISOString(),
      activeNodeCount: 0,
      avatarClass: 'bg-emerald-500',
      initials: 'SC',
    }

    render(
      <WorkspaceMembersSection
        members={[mockMember, collaboratorMember]}
        pendingInvitations={[]}
        simulatedRole="OWNER"
        onOpenInvite={vi.fn()}
        onRoleChange={handleRoleChange}
        onPromptDemote={vi.fn()}
        onPromptKick={vi.fn()}
      />
    )

    const select = screen.getByDisplayValue('COLLABORATOR')
    fireEvent.change(select, { target: { value: 'OWNER' } })

    expect(confirmSpy).toHaveBeenCalledWith(
      'Chuyển quyền chủ dự án cho sarah.chen? Bạn sẽ trở thành Cộng sự.'
    )
    expect(handleRoleChange).toHaveBeenCalledWith('usr-2', 'OWNER')

    confirmSpy.mockRestore()
  })
})
