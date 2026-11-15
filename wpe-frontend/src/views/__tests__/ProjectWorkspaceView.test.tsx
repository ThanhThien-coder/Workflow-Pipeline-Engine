// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { workflowService } from '../../services/container'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { ProjectSettingsDto } from '../../types/settings.types'
import type { UserSummary } from '../../types/kanban.types'

/** T1 (G5) — chế độ API: thanh bên và thanh trên dùng dự án, thành viên, người dùng thật. */

vi.mock('../../services/env', () => ({ isMockMode: false }))
vi.mock('../../components/views/WorkflowView', () => ({ WorkflowView: () => null }))
vi.mock('../../components/views/OverviewView', () => ({ OverviewView: () => null }))
vi.mock('../MyTasksView', () => ({ MyTasksView: () => null }))
vi.mock('../SettingsView', () => ({ default: () => null }))
vi.mock('../../components/common/NotificationBell', () => ({ default: () => null }))
vi.mock('../../components/common/GlobalProfileMenu', () => ({
  GlobalProfileMenu: (props: { displayName: string; roleLabel: string }) => (
    <div data-testid="profile">{`${props.displayName}|${props.roleLabel}`}</div>
  ),
}))
vi.mock('../../components/layout/CurvedCobaltSidebar', () => ({
  CurvedCobaltSidebar: (props: { projectName: string; projectStatus: string; teamMembers: { name?: string; username?: string }[] }) => (
    <div data-testid="sidebar">
      {`${props.projectName}|${props.projectStatus}|${props.teamMembers.map((m) => m.name || m.username).join(',')}`}
    </div>
  ),
}))

import { ProjectWorkspaceView } from '../ProjectWorkspaceView'

const INFO: ProjectSettingsDto = {
  id: '19', name: 'b', description: '', status: 'DRAFT', ownerId: '9', myRole: 'OWNER', createdAt: '', updatedAt: '',
}
const OWNER: UserSummary = {
  id: '9', name: 'a', roleTitle: 'OWNER', initials: 'A', avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0,
}

describe('ProjectWorkspaceView (chế độ API)', () => {
  beforeEach(() => {
    useWorkflowStore.setState((state) => ({
      auth: { ...state.auth, currentUser: { id: 9, username: 'a', email: 'a@gmail.com', systemRole: 'USER', name: 'Người A' } },
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('thanh bên hiện tên, trạng thái, thành viên thật; không còn tên/người giả', async () => {
    vi.spyOn(workflowService, 'getProjectSettings').mockResolvedValue(INFO)
    vi.spyOn(workflowService, 'getProjectMembers').mockResolvedValue([OWNER])

    render(<ProjectWorkspaceView projectId="19" subTab="workflow" />)

    await waitFor(() => expect(screen.getByTestId('sidebar').textContent).toBe('b|DRAFT|a'))
    expect(screen.getByTestId('profile').textContent).toBe('Người A|OWNER')
    expect(document.body.textContent).not.toContain('Marketing Campaign Q4')
    expect(document.body.textContent).not.toContain('Alex Kim')
  })

  it('tải lỗi thì báo lỗi, không hiện thành viên giả', async () => {
    vi.spyOn(workflowService, 'getProjectSettings').mockRejectedValue(new Error('Không có quyền'))
    vi.spyOn(workflowService, 'getProjectMembers').mockResolvedValue([OWNER])

    render(<ProjectWorkspaceView projectId="20" subTab="workflow" />)

    await waitFor(() => expect(screen.getByTestId('sidebar').textContent).toBe('Could not load project||'))
  })
})
