import { describe, it, expect } from 'vitest'
import { mapGuestOverviewResponse } from '../guest'

describe('guest phase label', () => {
  it('shows the phase name exactly as the backend sends it (backend no longer adds an order prefix)', () => {
    expect(mapGuestOverviewResponse({ phaseLabel: 'Phase One' }).phaseLabel).toBe('Phase One')
  })
  it('keeps numbers that are part of the phase name', () => {
    expect(mapGuestOverviewResponse({ phaseLabel: '1. Discovery & Architecture Design' }).phaseLabel).toBe(
      '1. Discovery & Architecture Design',
    )
  })
  it('falls back to "Whole workflow" when there is no phase', () => {
    expect(mapGuestOverviewResponse({}).phaseLabel).toBe('Whole workflow')
    expect(mapGuestOverviewResponse({ phaseLabel: '   ' }).phaseLabel).toBe('Whole workflow')
  })
})
