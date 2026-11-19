// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import NotificationBell from '../NotificationBell'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { workflowService } from '../../../services/container'
import * as router from '../../../router/useRouter'

describe('NotificationBell role notifications', () => {
  let sse: (eventName: string, data: any) => void
  let loadProject: ReturnType<typeof vi.fn>
  let loadMembers: ReturnType<typeof vi.fn>
  let loadSettings: ReturnType<typeof vi.fn>
  let showToast: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(workflowService as any).connectRealtime = vi.fn((_u: string, cb: any) => {
      sse = cb
      return () => {}
    })
    loadProject = vi.fn().mockResolvedValue(undefined)
    loadMembers = vi.fn().mockResolvedValue(undefined)
    loadSettings = vi.fn().mockResolvedValue(undefined)
    showToast = vi.fn()
    useWorkflowStore.setState((state: any) => ({
      ...state,
      auth: { ...state.auth, isAuthenticated: true, currentUser: { id: '10', username: 'u', email: 'u@x.io', role: 'USER' } },
      project: { ...state.project, loadProject },
      kanban: { ...state.kanban, loadMembers },
      settings: { ...state.settings, loadSettings, settings: { id: '7' } },
      ui: { ...state.ui, showToast },
    }))
    useNotificationStore.setState({
      items: [], unreadCount: 0, loading: false, error: false, load: vi.fn().mockResolvedValue(undefined),
    } as any)
  })

  afterEach(() => {
    cleanup()
    delete (workflowService as any).connectRealtime
    window.history.pushState({}, '', '/')
  })

  const note = (title: string, linkUrl: string) => ({
    id: '1', title, message: title, linkUrl, isRead: false, createdAt: new Date().toISOString(),
  })

  it('reloads project, members and settings when the role changed in the open project', async () => {
    window.history.pushState({}, '', '/project/7/settings')
    render(<NotificationBell />)
    sse('NOTIFICATION_RECEIVED', note('Your project role changed', '/project/7/workflow'))
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith('7'))
    expect(loadMembers).toHaveBeenCalledWith('7')
    expect(loadSettings).toHaveBeenCalledWith('7')
    expect(showToast).toHaveBeenCalledWith('Your role in this project has changed.')
  })

  it('does nothing extra when the role changed in a different project', async () => {
    window.history.pushState({}, '', '/project/99/workflow')
    render(<NotificationBell />)
    sse('NOTIFICATION_RECEIVED', note('Your project role changed', '/project/7/workflow'))
    await new Promise((r) => setTimeout(r, 20))
    expect(loadProject).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('navigates to /workspaces when removed from the open project', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {})
    window.history.pushState({}, '', '/project/7/workflow')
    render(<NotificationBell />)
    sse('NOTIFICATION_RECEIVED', note('Removed from project', '/workspaces?removedFrom=7'))
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/workspaces'))
    expect(showToast).toHaveBeenCalledWith('You were removed from this project.')
  })

  it('ignores removal of a project that is not open', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {})
    window.history.pushState({}, '', '/project/99/workflow')
    render(<NotificationBell />)
    sse('NOTIFICATION_RECEIVED', note('Removed from project', '/workspaces?removedFrom=7'))
    await new Promise((r) => setTimeout(r, 20))
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})
