// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { GuestAccessPopover } from '../GuestAccessPopover'
import type { GuestAccessState } from '../../../types/overview.types'

afterEach(() => cleanup())

const base = { expiresAt: '', expiresLabel: '' }
const noop = async () => {}

function mount(state: GuestAccessState) {
  return render(<GuestAccessPopover state={state} onRevoke={noop} onGenerate={noop} notify={vi.fn()} />)
}

describe('GuestAccessPopover: 3 states', () => {
  it('never created: plain "Guest Link", no red dot, invites creating a link', () => {
    const { container } = mount({ ...base, isActive: false, token: '' })
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Guest Link')
    expect(button.textContent).not.toContain('Revoked')
    expect(container.querySelector('.bg-red-500')).toBeNull()
    fireEvent.click(button)
    expect(screen.queryByText(/Link Revoked/)).toBeNull()
    expect(screen.getByText('No Guest Link')).toBeDefined()
    expect(screen.getByText('Create Guest Link')).toBeDefined()
  })

  it('active: shows the share button and the wrapped token', () => {
    const token = 'a'.repeat(64)
    mount({ ...base, isActive: true, token, expiresLabel: '2026-12-01 (3 days left)' })
    fireEvent.click(screen.getByRole('button', { name: /Share Guest Link/ }))
    const line = screen.getByText(`token: ${token}`)
    expect(line.className).toContain('break-all')
    expect(screen.getByText('Revoke Guest Access (Deactivate Token)')).toBeDefined()
  })

  it('revoked in this session: shows "Guest Link (Revoked)" with the red dot and revoked box', () => {
    const { container } = mount({ ...base, isActive: false, token: '', revoked: true, expiresLabel: 'Revoked' })
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Guest Link (Revoked)')
    expect(container.querySelector('.bg-red-500')).not.toBeNull()
    fireEvent.click(button)
    expect(screen.getByText(/Link Revoked/)).toBeDefined()
    expect(screen.getByText('Generate New Token')).toBeDefined()
  })

  it('status from backend after reload: revoked shows the revoked box and red dot', () => {
    const { container } = mount({ ...base, isActive: false, token: '', status: 'revoked', revoked: true, expiresLabel: 'Revoked' })
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Guest Link (Revoked)')
    expect(container.querySelector('.bg-red-500')).not.toBeNull()
    fireEvent.click(button)
    expect(screen.getByText(/Link Revoked/)).toBeDefined()
  })

  it('status expired: shows "Link Expired" and a button to generate a new link', () => {
    const { container } = mount({ ...base, isActive: false, token: '', status: 'expired', expiresLabel: 'Expired' })
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Guest Link (Expired)')
    expect(container.querySelector('.bg-red-500')).toBeNull()
    fireEvent.click(button)
    expect(screen.getByText(/Link Expired/)).toBeDefined()
    expect(screen.queryByText(/Link Revoked/)).toBeNull()
    expect(screen.getByText('Generate New Token')).toBeDefined()
  })

  it('status none: shows "No Guest Link"', () => {
    mount({ ...base, isActive: false, token: '', status: 'none' })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No Guest Link')).toBeDefined()
    expect(screen.getByText('Create Guest Link')).toBeDefined()
  })

  it('status active: shows the active box', () => {
    mount({ ...base, isActive: true, token: 'b'.repeat(64), status: 'active', expiresLabel: '2026-12-01 (3 days left)' })
    fireEvent.click(screen.getByRole('button', { name: /Share Guest Link/ }))
    expect(screen.getByText(/Access Active/)).toBeDefined()
    expect(screen.getByText('Choose which artifacts guests can see in the Artifacts panel.')).toBeDefined()
  })
})
