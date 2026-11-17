// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProjectCard } from '../ProjectCard'
import type { ProjectCardVm } from '../../../types/workspace.types'

const baseVm: ProjectCardVm = {
  id: 1,
  name: 'Core Banking',
  desc: 'Desc',
  status: 'ACTIVE',
  role: 'OWNER',
  nodes: 5,
  crit: 2,
  done: 40,
  upd: 'just now',
  ts: 1,
  tone: 'indigo',
  icon: 'A',
  roleLabel: 'Owner',
  members: [
    { name: 'Alex Kim', avatarUrl: '/uploads/avatars/example-alex.png' },
    { name: 'Bob Stone', avatarUrl: null },
  ],
}

describe('ProjectCard (TASK_55)', () => {
  afterEach(() => cleanup())

  it('thành viên có avatarUrl hiện <img>, thành viên không có ảnh hiện chữ viết tắt', () => {
    render(<ProjectCard p={baseVm} index={0} onOpen={vi.fn()} />)
    const img = screen.getByAltText('Alex Kim') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/uploads/avatars/example-alex.png')
    expect(screen.queryByAltText('Bob Stone')).toBeNull()
    expect(screen.getByText('BS')).toBeTruthy()
  })
})
