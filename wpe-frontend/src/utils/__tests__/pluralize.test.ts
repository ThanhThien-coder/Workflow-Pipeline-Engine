import { describe, it, expect } from 'vitest'
import { pluralize } from '../pluralize'
import { integerAxis } from '../chartTicks'
import { fmtDueDate } from '../date'

describe('pluralize', () => {
  it('uses singular only for exactly 1', () => {
    expect(pluralize(1, 'phase')).toBe('1 phase')
    expect(pluralize(0, 'phase')).toBe('0 phases')
    expect(pluralize(2, 'task')).toBe('2 tasks')
    expect(pluralize(2, 'day', 'days')).toBe('2 days')
    expect(pluralize(1, 'person', 'people')).toBe('1 person')
    expect(pluralize(3, 'person', 'people')).toBe('3 people')
  })
})

describe('integerAxis', () => {
  const unique = (xs: number[]) => new Set(xs).size === xs.length
  it.each([0, 1, 2, 3, 4, 5, 7, 11, 100])('max %i gives unique integer ticks from top to 0', (raw) => {
    const axis = integerAxis(raw)
    expect(axis.ticks.every(Number.isInteger)).toBe(true)
    expect(unique(axis.ticks)).toBe(true)
    expect(axis.ticks[0]).toBe(axis.max)
    expect(axis.ticks[axis.ticks.length - 1]).toBe(0)
    expect(axis.max).toBeGreaterThanOrEqual(Math.max(1, raw))
  })
  it('small value 1 gives 1 and 0 only', () => {
    expect(integerAxis(1).ticks).toEqual([1, 0])
  })
})

describe('fmtDueDate', () => {
  it('shows "No due date" for empty or invalid values', () => {
    expect(fmtDueDate('')).toBe('No due date')
    expect(fmtDueDate(null)).toBe('No due date')
    expect(fmtDueDate('garbage')).toBe('No due date')
  })
  it('formats a real date in en-US', () => {
    expect(fmtDueDate('2026-11-18T12:00:00')).toBe('Nov 18')
  })
})
