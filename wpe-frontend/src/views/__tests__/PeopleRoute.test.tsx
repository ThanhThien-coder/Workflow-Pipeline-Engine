// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import App from '../../App'
import { useWorkflowStore } from '../../store/useWorkflowStore'

const { getUserProfile } = vi.hoisted(() => ({ getUserProfile: vi.fn() }))

vi.mock('../../services/container', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/container')>()
  const profileService = { ...original.profileService, getUserProfile }
  return { ...original, profileService, container: { ...original.container, profileService } }
})

describe('Route /people/:id (TASK_56)', () => {
  beforeEach(() => {
    getUserProfile.mockReset()
    getUserProfile.mockResolvedValue({
      userId: '7',
      displayName: 'Sam Lee',
      title: '',
      bio: '',
      avatarUrl: null,
      skills: [],
      links: { github: '', linkedin: '', website: '' },
      email: null,
      stats: null,
      projects: [],
      isSelf: false,
    })
  })
  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', '/')
  })

  it('đã đăng nhập: /people/7 render PublicProfileView với đúng id', async () => {
    useWorkflowStore.setState((s) => ({ auth: { ...s.auth, isAuthenticated: true, hydrate: () => {} } }))
    window.history.pushState({}, '', '/people/7')
    render(<App />)
    expect(await screen.findByText('Sam Lee')).toBeTruthy()
    expect(getUserProfile).toHaveBeenCalledWith('7')
  })

  it('chưa đăng nhập: bị chuyển về /auth và không gọi API hồ sơ', async () => {
    useWorkflowStore.setState((s) => ({ auth: { ...s.auth, isAuthenticated: false, hydrate: () => {} } }))
    window.history.pushState({}, '', '/people/7')
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/auth'))
    expect(getUserProfile).not.toHaveBeenCalled()
  })
})
