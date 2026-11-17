// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { UserManagementTab } from '../UserManagementTab'
import type { AdminUserDto } from '../../../../types/admin.types'

const baseUser: AdminUserDto = {
  id: '2',
  name: 'Alex Kim',
  username: 'alex.kim',
  maskedEmail: 'a***@pipeline.engine',
  role: 'STANDARD_USER',
  status: 'ACTIVE',
  ownedProjectCount: 1,
  joinedProjectCount: 2,
  createdAt: '2026-10-01T10:00:00Z',
}

function renderTab(users: AdminUserDto[]) {
  return render(
    <UserManagementTab
      users={users}
      searchQuery=""
      onSearchChange={vi.fn()}
      statusFilter="ALL"
      onStatusFilterChange={vi.fn()}
      onOpenBanModal={vi.fn()}
      onUnban={vi.fn()}
      currentUserId="1"
      onChangeRole={vi.fn()}
      onDeleteUser={vi.fn()}
      onOpenOwnedProjects={vi.fn()}
    />,
  )
}

describe('UserManagementTab (TASK_55)', () => {
  afterEach(() => cleanup())

  it('user có avatarUrl hiện ảnh', () => {
    renderTab([{ ...baseUser, avatarUrl: '/uploads/avatars/example-alex.png' }])
    const img = screen.getByAltText('Alex Kim') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/uploads/avatars/example-alex.png')
  })

  it('user không có ảnh hiện chữ viết tắt', () => {
    renderTab([{ ...baseUser, avatarUrl: null }])
    expect(screen.queryByAltText('Alex Kim')).toBeNull()
    expect(screen.getByText('AK')).toBeTruthy()
  })
})
