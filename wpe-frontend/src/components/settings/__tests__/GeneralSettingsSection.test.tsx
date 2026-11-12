// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { GeneralSettingsSection } from '../GeneralSettingsSection'
import { container } from '../../../services/container'
import type { ProjectSettingsDto } from '../../../types/settings.types'

describe('GeneralSettingsSection Component', () => {
  const mockOnSave = vi.fn().mockResolvedValue(true)
  const mockOnPublish = vi.fn().mockResolvedValue(true)
  const mockOnRestore = vi.fn().mockResolvedValue(undefined)

  const defaultSettings: ProjectSettingsDto = {
    id: 'proj-123',
    name: 'Fintech Core Engine',
    description: 'Core banking transaction processor',
    status: 'ACTIVE',
    ownerId: 'usr-1',
    myRole: 'OWNER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders "Lưu thành template" button only when myRole is OWNER', () => {
    const { rerender } = render(
      <GeneralSettingsSection
        settings={defaultSettings}
        myRole="OWNER"
        onSave={mockOnSave}
        onPublish={mockOnPublish}
        onRestore={mockOnRestore}
        projectId="proj-123"
      />
    )

    expect(screen.getByText('Lưu thành template')).toBeDefined()

    rerender(
      <GeneralSettingsSection
        settings={{ ...defaultSettings, myRole: 'COLLABORATOR' }}
        myRole="COLLABORATOR"
        onSave={mockOnSave}
        onPublish={mockOnPublish}
        onRestore={mockOnRestore}
        projectId="proj-123"
      />
    )

    expect(screen.queryByText('Lưu thành template')).toBeNull()
  })

  it('opens template input and calls saveProjectAsTemplate with correct name and project id on save', async () => {
    const saveSpy = vi.spyOn(container.templateService, 'saveProjectAsTemplate').mockResolvedValue({
      id: 'tpl-new-1',
      name: 'Custom Banking Pipeline',
      description: 'Exported from project',
      category: 'General',
      isSystemStandard: false,
      phaseCount: 2,
      nodeCount: 5,
      cloneCount: 0,
      createdBy: 'usr-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visibility: 'PRIVATE',
      sourceProjectId: 'proj-123',
      graphData: {
        schemaVersion: 2,
        phases: [],
        phaseEdges: [],
        nodes: [],
        edges: [],
        metadata: { version: '1' },
      },
    })

    render(
      <GeneralSettingsSection
        settings={defaultSettings}
        myRole="OWNER"
        onSave={mockOnSave}
        onPublish={mockOnPublish}
        onRestore={mockOnRestore}
        projectId="proj-123"
      />
    )

    const openBtn = screen.getByText('Lưu thành template')
    fireEvent.click(openBtn)

    expect(screen.getByText('Lưu dự án thành Template riêng')).toBeDefined()

    const nameInput = screen.getByPlaceholderText('Nhập tên template...')
    fireEvent.change(nameInput, { target: { value: 'Custom Banking Pipeline' } })

    const saveBtn = screen.getByText('Lưu')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith('proj-123', {
        name: 'Custom Banking Pipeline',
        description: undefined,
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Đã lưu template riêng của bạn')).toBeDefined()
    })
  })
})
