// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import NotificationBell from '../NotificationBell'
import { useNotificationStore } from '../../../store/useNotificationStore'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { workflowService } from '../../../services/container'
import * as router from '../../../router/useRouter'

describe('NotificationBell (FC3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('clicking an invitation notification calls markRead and navigates to linkUrl', async () => {
    const deepLink = '/workspace?action=open-invite-modal&invitationId=77'
    const markReadSpy = vi.fn().mockResolvedValue(undefined)
    const loadSpy = vi.fn().mockResolvedValue(undefined)
    const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => {})

    useNotificationStore.setState({
      items: [
        {
          id: '501',
          kind: 'invitation',
          actorName: null,
          text: 'Alex Kim đã mời bạn tham gia dự án "Core Banking Pipeline"',
          title: 'Lời mời tham gia dự án: Core Banking Pipeline',
          message: 'Alex Kim đã mời bạn tham gia dự án "Core Banking Pipeline"',
          linkUrl: deepLink,
          targetPath: '',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
      loading: false,
      error: false,
      load: loadSpy,
      markRead: markReadSpy,
      markAllRead: vi.fn().mockResolvedValue(undefined),
    })

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /Notifications/i })
    expect(screen.getByText('1')).toBeDefined()

    fireEvent.click(bellButton)

    const notifItem = await screen.findByText(/Alex Kim đã mời bạn tham gia dự án/i)
    fireEvent.click(notifItem)

    await waitFor(() => {
      expect(markReadSpy).toHaveBeenCalledWith('501')
      expect(navigateSpy).toHaveBeenCalledWith(deepLink)
    })
  })

  it('reloads notifications and updates unread count when NOTIFICATION_RECEIVED SSE arrives', async () => {
    let sseCallback: ((eventName: string, data: any) => void) | null = null
    ;(workflowService as any).connectRealtime = vi.fn((_uid: string, cb: (eventName: string, data: any) => void) => {
      sseCallback = cb
      return () => {}
    })

    useWorkflowStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        isAuthenticated: true,
        currentUser: {
          id: '10',
          username: 'meomeo',
          email: 'meomeo@pipeline.engine',
          role: 'USER',
        } as any,
      },
    }))

    const loadSpy = vi.fn().mockResolvedValue(undefined)
    useNotificationStore.setState({
      items: [],
      unreadCount: 0,
      loading: false,
      error: false,
      load: loadSpy,
    })

    render(<NotificationBell />)

    expect(sseCallback).not.toBeNull()
    loadSpy.mockClear()

    sseCallback!('NOTIFICATION_RECEIVED', {
      id: '888',
      title: 'Lời mời tham gia dự án: Alpha',
      message: 'Alex Kim đã mời bạn tham gia dự án "Alpha"',
      linkUrl: '/workspace?action=open-invite-modal&invitationId=88',
      isRead: false,
      createdAt: new Date().toISOString(),
    })

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalled()
      expect(useNotificationStore.getState().unreadCount).toBe(1)
      expect(useNotificationStore.getState().items[0]?.linkUrl).toContain('invitationId=88')
    })

    delete (workflowService as any).connectRealtime
  })
})
