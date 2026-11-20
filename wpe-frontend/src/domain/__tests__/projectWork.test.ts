import { describe, it, expect } from 'vitest'
import { isProjectStarted } from '../projectWork'

describe('isProjectStarted (G33)', () => {
  it('DRAFT, PLANNING hoặc chưa tải trạng thái: chưa Start', () => {
    expect(isProjectStarted('DRAFT')).toBe(false)
    expect(isProjectStarted('PLANNING')).toBe(false)
    expect(isProjectStarted(null)).toBe(false)
    expect(isProjectStarted(undefined)).toBe(false)
  })

  it('ACTIVE, PAUSED, COMPLETED: đã Start', () => {
    expect(isProjectStarted('ACTIVE')).toBe(true)
    expect(isProjectStarted('PAUSED')).toBe(true)
    expect(isProjectStarted('COMPLETED')).toBe(true)
  })
})
