// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WeeklyVelocityCard } from '../WeeklyVelocityCard'

afterEach(() => cleanup())

describe('WeeklyVelocityCard Y axis', () => {
  it('does not repeat labels when values are small', () => {
    const days = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day, i) => ({ day, tasks: i === 2 ? 1 : 0, isPeak: i === 2 }))
    const { container } = render(<WeeklyVelocityCard velocity={{ periodLabel: 'This week', days }} />)
    const axis = container.querySelector('.w-6') as HTMLElement
    const labels = Array.from(axis.querySelectorAll('span')).map((s) => s.textContent)
    expect(labels).toEqual(['1', '0'])
  })
})
