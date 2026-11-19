// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { DemoToolsPanel } from '../DemoToolsPanel'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { ApiError } from '../../../services/http/ApiError'
import * as demo from '../../../services/impl/http/demo'

vi.mock('../../../services/impl/http/demo', () => ({
  fetchDemoStatus: vi.fn(),
  makeOverdue: vi.fn(),
  runOverdueScan: vi.fn(),
  forceStatus: vi.fn(),
  completeAllInPhase: vi.fn(),
  resetAiCooldown: vi.fn(),
  expireGuestLink: vi.fn(),
  expireInvitations: vi.fn(),
  sendTestNotification: vi.fn(),
}))

const loadPhases = vi.fn().mockResolvedValue(undefined)
const showToast = vi.fn()
const loadTasks = vi.fn().mockResolvedValue(undefined)

function setup(opts: { myRole: 'OWNER' | 'COLLABORATOR'; systemRole: 'ADMIN' | 'USER'; activeTab?: 'workflow' | 'my-tasks'; settingsProjectId?: string }) {
  const s = useWorkflowStore.getState()
  useWorkflowStore.setState({
    activeTab: opts.activeTab ?? 'workflow',
    loadPhases,
    macroPhases: [{ id: '7', name: 'Design', sub: '', status: 'TODO', pct: 0, accent: 'blue', w: 1, h: 1 } as never],
    trees: {
      '7': {
        root: { id: 'root', kind: 'root', parentIds: [], title: 'Root' },
        '9': {
          id: '9', kind: 'branch', parentIds: [], title: 'Task Nine', code: 'T9', description: '',
          isTrack: false, status: 'TODO', assignee: null, due: null, blocker: null, joinPolicy: null,
        },
      } as never,
    },
    auth: { ...s.auth, currentUser: { id: 1, username: 'u', email: 'u@x', systemRole: opts.systemRole } },
    settings: { ...s.settings, settings: { ...(s.settings.settings ?? {}), id: opts.settingsProjectId ?? '5', myRole: opts.myRole } as never },
    project: { ...s.project, projectId: null, info: null },
    ui: { ...s.ui, showToast },
    kanban: { ...s.kanban, loadTasks },
  })
}

describe('DemoToolsPanel (TASK_74)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('status false -> không render', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(false)
    setup({ myRole: 'OWNER', systemRole: 'USER' })
    render(<DemoToolsPanel projectId="5" />)
    await waitFor(() => expect(demo.fetchDemoStatus).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Toggle demo tools')).toBeNull()
  })

  it('status true + OWNER -> render', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    setup({ myRole: 'OWNER', systemRole: 'USER' })
    render(<DemoToolsPanel projectId="5" />)
    expect(await screen.findByLabelText('Toggle demo tools')).toBeDefined()
  })

  it('status true + COLLABORATOR (không ADMIN) -> không render', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    setup({ myRole: 'COLLABORATOR', systemRole: 'USER' })
    render(<DemoToolsPanel projectId="5" />)
    await waitFor(() => expect(demo.fetchDemoStatus).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByLabelText('Toggle demo tools')).toBeNull()
  })

  it('vai trò OWNER nhưng của dự án KHÁC (Settings còn dữ liệu cũ) -> không render', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    setup({ myRole: 'OWNER', systemRole: 'USER', settingsProjectId: '99' })
    render(<DemoToolsPanel projectId="5" />)
    await waitFor(() => expect(demo.fetchDemoStatus).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByLabelText('Toggle demo tools')).toBeNull()
  })

  it('status true + ADMIN hệ thống -> render', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    setup({ myRole: 'COLLABORATOR', systemRole: 'ADMIN' })
    render(<DemoToolsPanel projectId="5" />)
    expect(await screen.findByLabelText('Toggle demo tools')).toBeDefined()
  })

  it('Make overdue now gọi đúng id task rồi loadPhases', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    vi.mocked(demo.makeOverdue).mockResolvedValue({})
    setup({ myRole: 'OWNER', systemRole: 'USER' })
    render(<DemoToolsPanel projectId="5" />)
    fireEvent.click(await screen.findByLabelText('Toggle demo tools'))
    expect(screen.getByText('Demo tools (testing only)')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Demo phase'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Demo task'), { target: { value: '9' } })
    fireEvent.click(screen.getByText('Make overdue now'))
    await waitFor(() => expect(loadPhases).toHaveBeenCalledWith('5'))
    expect(demo.makeOverdue).toHaveBeenCalledWith('5', '9')
    expect(showToast).toHaveBeenCalled()
    expect(loadTasks).not.toHaveBeenCalled()
  })

  it('đang ở My Tasks thì tải lại kanban', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    vi.mocked(demo.resetAiCooldown).mockResolvedValue(undefined)
    setup({ myRole: 'OWNER', systemRole: 'USER', activeTab: 'my-tasks' })
    render(<DemoToolsPanel projectId="5" />)
    fireEvent.click(await screen.findByLabelText('Toggle demo tools'))
    fireEvent.click(screen.getByText('Reset AI cooldown'))
    await waitFor(() => expect(loadTasks).toHaveBeenCalledWith('5'))
  })

  it('lỗi API hiện message của ApiError và không tải lại đồ thị', async () => {
    vi.mocked(demo.fetchDemoStatus).mockResolvedValue(true)
    vi.mocked(demo.runOverdueScan).mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Demo tools are disabled.' }),
    )
    setup({ myRole: 'OWNER', systemRole: 'USER' })
    render(<DemoToolsPanel projectId="5" />)
    fireEvent.click(await screen.findByLabelText('Toggle demo tools'))
    fireEvent.click(screen.getByText('Run overdue scan'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Demo tools are disabled.'))
    expect(loadPhases).not.toHaveBeenCalled()
  })
})
