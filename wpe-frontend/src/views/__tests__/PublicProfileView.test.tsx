// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PublicProfileView from '../PublicProfileView'
import { ProfileNotFoundError } from '../../types/profile.types'
import type { PublicProfileDto } from '../../types/profile.types'

const { getUserProfile } = vi.hoisted(() => ({ getUserProfile: vi.fn() }))

vi.mock('../../services/container', () => ({
  profileService: { getUserProfile },
}))

const base: PublicProfileDto = {
  userId: '7',
  displayName: 'Sam Lee',
  title: 'Product Designer',
  bio: 'Designs calm interfaces.',
  avatarUrl: null,
  skills: ['Figma', 'Research'],
  links: { github: 'https://github.com/samlee', linkedin: '', website: 'https://sam.example.com' },
  email: 'sam@example.com',
  stats: { tasksDone: 8, tasksTotal: 10, onTimePct: 88 },
  projects: [
    {
      projectId: '1',
      name: 'Marketing Campaign Q4',
      phaseLabel: 'Phase 2 · Published',
      role: 'Collaborator',
      contribution: 'Completed 8 of 10 assigned tasks',
      isPublic: true,
      stats: { tasksDone: 8, tasksTotal: 10, onTimePct: 88 },
    },
  ],
  isSelf: false,
}

describe('PublicProfileView (TASK_56)', () => {
  beforeEach(() => {
    getUserProfile.mockReset()
    window.history.pushState({}, '', '/people/7')
  })
  afterEach(() => cleanup())

  it('gọi getUserProfile với đúng id và hiện thông tin chính', async () => {
    getUserProfile.mockResolvedValue(base)
    render(<PublicProfileView userId="7" />)
    expect(await screen.findByText('Sam Lee')).toBeTruthy()
    expect(getUserProfile).toHaveBeenCalledWith('7')
    expect(screen.getByText('Product Designer')).toBeTruthy()
    expect(screen.getByText('Designs calm interfaces.')).toBeTruthy()
    expect(screen.getByText('Figma')).toBeTruthy()
    expect(screen.getByText('Marketing Campaign Q4')).toBeTruthy()
    expect(screen.getByText('Collaborator')).toBeTruthy()
    expect(screen.getByText('Phase 2 · Published')).toBeTruthy()
    expect(screen.getByText('sam@example.com')).toBeTruthy()
    expect(screen.getByText('Tasks done')).toBeTruthy()
    expect(screen.getByText('88%', { selector: 'dd' })).toBeTruthy()
  })

  it('đang tải thì hiện trạng thái loading', () => {
    getUserProfile.mockReturnValue(new Promise(() => {}))
    render(<PublicProfileView userId="7" />)
    expect(screen.getAllByText('Loading profile…').length).toBeGreaterThan(0)
  })

  it('link ngoài mở tab mới với rel noopener noreferrer', async () => {
    getUserProfile.mockResolvedValue(base)
    render(<PublicProfileView userId="7" />)
    const gh = (await screen.findByText('GitHub')).closest('a') as HTMLAnchorElement
    expect(gh.getAttribute('href')).toBe('https://github.com/samlee')
    expect(gh.getAttribute('target')).toBe('_blank')
    expect(gh.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.queryByText('LinkedIn')).toBeNull()
    expect(screen.getByText('Website')).toBeTruthy()
  })

  it('email và thống kê null thì không hiện', async () => {
    getUserProfile.mockResolvedValue({ ...base, email: null, stats: null })
    render(<PublicProfileView userId="7" />)
    await screen.findByText('Sam Lee')
    expect(screen.queryByText('sam@example.com')).toBeNull()
    expect(screen.queryByText('Tasks done')).toBeNull()
    expect(screen.queryByText('On time')).toBeNull()
  })

  it('404 thì hiện "private or doesn\'t exist" và nút Back', async () => {
    getUserProfile.mockRejectedValue(new ProfileNotFoundError())
    render(<PublicProfileView userId="7" />)
    expect(await screen.findByText("This profile is private or doesn't exist.")).toBeTruthy()
    expect(screen.queryByText('Sam Lee')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Back/ }).length).toBeGreaterThan(0)
  })

  it('lỗi khác 404 hiện thông báo lỗi chung, không nói là private', async () => {
    getUserProfile.mockRejectedValue(new Error('boom'))
    render(<PublicProfileView userId="7" />)
    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(screen.queryByText("This profile is private or doesn't exist.")).toBeNull()
  })

  it('nút "Edit my profile" chỉ hiện khi isSelf và dẫn tới /profile', async () => {
    getUserProfile.mockResolvedValue(base)
    const { unmount } = render(<PublicProfileView userId="7" />)
    await screen.findByText('Sam Lee')
    expect(screen.queryByText('Edit my profile')).toBeNull()
    unmount()

    getUserProfile.mockResolvedValue({ ...base, isSelf: true })
    render(<PublicProfileView userId="7" />)
    const btn = await screen.findByText('Edit my profile')
    fireEvent.click(btn)
    expect(window.location.pathname).toBe('/profile')
  })

  it('không có dự án thì hiện câu trống', async () => {
    getUserProfile.mockResolvedValue({ ...base, projects: [] })
    render(<PublicProfileView userId="7" />)
    expect(await screen.findByText('No projects to show.')).toBeTruthy()
  })
})
