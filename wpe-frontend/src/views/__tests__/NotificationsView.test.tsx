// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import NotificationsView from '../NotificationsView'
import { useNotificationStore } from '../../store/useNotificationStore'

afterEach(() => cleanup())

function mount(unreadCount: number) {
  useNotificationStore.setState({ items: [], unreadCount, loading: false, error: null, load: vi.fn().mockResolvedValue(undefined) } as never)
  render(<NotificationsView />)
}

describe('NotificationsView "Mark all as read"', () => {
  it('is hidden when everything is read', () => {
    mount(0)
    expect(screen.getByText('You are all caught up')).toBeDefined()
    expect(screen.queryByText('Mark all as read')).toBeNull()
  })
  it('is shown when there are unread notifications', () => {
    mount(2)
    expect(screen.getByText('Mark all as read')).toBeDefined()
  })
})
