// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WorkspaceView } from '../WorkspaceView'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { ProjectCardVm } from '../../../types/workspace.types'

const mockProjects: readonly ProjectCardVm[] = [
  {
    id: '1',
    name: 'Alpha Project',
    desc: 'Alpha description',
    role: 'OWNER',
    status: 'ACTIVE',
    nodes: 10,
    crit: 2,
    done: 50,
    upd: 'Just now',
    ts: 1000,
    tone: 'indigo',
    icon: 'A',
    roleLabel: 'Owner',
    members: [{ name: 'Alex', avatarUrl: null }, { name: 'Bob', avatarUrl: null }],
  },
  {
    id: '2',
    name: 'Beta Pipeline',
    desc: 'Beta description',
    role: 'COLLABORATOR',
    status: 'ACTIVE',
    nodes: 8,
    crit: 1,
    done: 75,
    upd: '1 hour ago',
    ts: 2000,
    tone: 'sky',
    icon: 'B',
    roleLabel: 'Collaborator',
    members: [{ name: 'Charlie', avatarUrl: null }],
  },
]

describe('WorkspaceView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkflowStore.setState((s) => ({
      workspace: {
        ...s.workspace,
        projects: mockProjects,
      },
      auth: {
        ...s.auth,
        currentUser: { id: 1, username: 'alex', email: 'alex@wpe.io', systemRole: 'USER' },
      },
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('ô tìm kiếm ở header có placeholder "Search projects...", nối vào bộ lọc dự án và không hiện toast demo khi Enter', () => {
    const showToast = vi.fn()
    useWorkflowStore.setState((s) => ({ ui: { ...s.ui, showToast } }))

    render(<WorkspaceView />)

    const topSearch = screen.getByPlaceholderText('Search projects...') as HTMLInputElement
    expect(topSearch).toBeTruthy()

    expect(screen.getByText('Alpha Project')).toBeTruthy()
    expect(screen.getByText('Beta Pipeline')).toBeTruthy()

    fireEvent.change(topSearch, { target: { value: 'Beta' } })
    expect(topSearch.value).toBe('Beta')

    fireEvent.keyDown(topSearch, { key: 'Enter', code: 'Enter' })
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('demo'))

    expect(screen.queryByText('Alpha Project')).toBeNull()
    expect(screen.getByText('Beta Pipeline')).toBeTruthy()
  })
})
