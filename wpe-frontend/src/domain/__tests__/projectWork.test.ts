import { describe, it, expect } from 'vitest'
import { isProjectStarted } from '../projectWork'

describe('isProjectStarted (G33)', () => {
  it('DRAFT hoặc chưa tải trạng thái: chưa Start', () => {
    expect(isProjectStarted('DRAFT')).toBe(false)
    expect(isProjectStarted(null)).toBe(false)
    expect(isProjectStarted(undefined)).toBe(false)
  })

  it('ACTIVE: đã Start', () => {
    expect(isProjectStarted('ACTIVE')).toBe(true)
  })
})
