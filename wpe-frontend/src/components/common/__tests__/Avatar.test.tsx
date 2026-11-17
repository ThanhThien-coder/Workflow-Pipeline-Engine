// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Avatar } from '../Avatar'

describe('Avatar (TASK_55)', () => {
  afterEach(() => cleanup())

  it('hiện ảnh khi có avatarUrl', () => {
    render(<Avatar name="Alex Kim" avatarUrl="/uploads/avatars/example-alex.png" />)
    const img = screen.getByAltText('Alex Kim') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/uploads/avatars/example-alex.png')
  })

  it('hiện chữ viết tắt khi không có avatarUrl', () => {
    render(<Avatar name="Alex Kim" avatarUrl={null} />)
    expect(screen.queryByAltText('Alex Kim')).toBeNull()
    expect(screen.getByText('AK')).toBeTruthy()
  })

  it('ảnh tải lỗi thì quay về chữ viết tắt', () => {
    render(<Avatar name="Alex Kim" avatarUrl="/uploads/avatars/example-missing.png" />)
    fireEvent.error(screen.getByAltText('Alex Kim'))
    expect(screen.queryByAltText('Alex Kim')).toBeNull()
    expect(screen.getByText('AK')).toBeTruthy()
  })
})
