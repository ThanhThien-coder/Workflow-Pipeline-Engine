// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RecentActivityCard } from '../RecentActivityCard'
import type { ActivityItem } from '../../../types/overview.types'

const item = (over: Partial<ActivityItem['actor']>): ActivityItem => ({
  id: 'a1',
  actor: { id: '2', initials: 'AK', name: 'Alex Kim', avatarClass: 'bg-indigo-500', avatarUrl: null, ...over },
  action: 'CLAIMED',
  message: 'did something',
  nodeCode: 'WPE-1',
  occurredAt: new Date().toISOString(),
})

describe('RecentActivityCard (TASK_55)', () => {
  afterEach(() => cleanup())

  it('hiện ảnh của actor khi có avatarUrl', () => {
    render(<RecentActivityCard items={[item({ avatarUrl: '/uploads/avatars/example-alex.png' })]} />)
    const img = screen.getByAltText('Alex Kim') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/uploads/avatars/example-alex.png')
  })

  it('không có ảnh thì hiện chữ viết tắt', () => {
    render(<RecentActivityCard items={[item({})]} />)
    expect(screen.queryByAltText('Alex Kim')).toBeNull()
    expect(screen.getByText('AK')).toBeTruthy()
  })
})
