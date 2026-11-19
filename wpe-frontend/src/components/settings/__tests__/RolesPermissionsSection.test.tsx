// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { RolesPermissionsSection } from '../RolesPermissionsSection'
import { SettingsHeader } from '../SettingsHeader'
import { InviteMemberModal } from '../InviteMemberModal'
import { RoleBadge } from '../../common/RoleBadge'

afterEach(() => cleanup())

describe('RolesPermissionsSection', () => {
  it('shows 4 role columns and marks Approve or return tasks for Owner and Manager only', () => {
    render(<RolesPermissionsSection myRole="COLLABORATOR" />)

    for (const name of ['Owner', 'Manager', 'Collaborator', 'Viewer']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeDefined()
    }

    const rowHeader = screen.getByRole('rowheader', { name: 'Approve or return tasks' })
    const cells = within(rowHeader.closest('tr') as HTMLElement).getAllByRole('cell')
    expect(cells).toHaveLength(4)
    expect(within(cells[0]).getByLabelText('Allowed')).toBeDefined()
    expect(within(cells[1]).getByLabelText('Allowed')).toBeDefined()
    expect(within(cells[2]).getByLabelText('Not allowed')).toBeDefined()
    expect(within(cells[3]).getByLabelText('Not allowed')).toBeDefined()
  })

  it('highlights only the current role column', () => {
    const { container } = render(<RolesPermissionsSection myRole="MANAGER" />)
    const current = container.querySelectorAll('[data-current="true"]')
    expect(current.length).toBeGreaterThan(0)
    current.forEach((el) => expect(el.getAttribute('data-role')).toBe('MANAGER'))
    expect(container.querySelectorAll('th[data-current="true"]')).toHaveLength(1)
  })
})

describe('SettingsHeader role line', () => {
  it('shows the current role and keeps the read-only banner for non-owners', () => {
    render(<SettingsHeader myRole="VIEWER" />)
    expect(screen.getByText(/Your role: VIEWER/)).toBeDefined()
    expect(screen.getByText(/read-only mode/)).toBeDefined()
  })
  it('hides the read-only banner for owners', () => {
    render(<SettingsHeader myRole="OWNER" />)
    expect(screen.getByText(/Your role: OWNER/)).toBeDefined()
    expect(screen.queryByText(/read-only mode/)).toBeNull()
  })
})

describe('InviteMemberModal role descriptions', () => {
  it('no longer claims Collaborator can edit pipelines', () => {
    const { container } = render(<InviteMemberModal isOpen onClose={() => {}} onInvite={async () => true} />)
    expect(container.textContent).not.toContain('Can edit tasks and pipelines')
    expect(container.textContent).toContain('COLLABORATOR')
  })
})

describe('RoleBadge', () => {
  it('has a tooltip describing the role', () => {
    render(<RoleBadge role="VIEWER" />)
    expect(screen.getByText('VIEWER').getAttribute('title')).toMatch(/Read-only/)
  })
})
