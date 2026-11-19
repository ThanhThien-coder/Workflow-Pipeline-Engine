// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { workflowService } from '../../../services/container'
import { ProjectStatusControl, actionsForStatus } from '../ProjectStatusControl'
import type { ProjectSettingsDto } from '../../../types/settings.types'

/** Trạng thái dự án đổi ở màn Workflow: Start (publish) / Pause / Resume / Complete / Reopen, chỉ chủ dự án. */

const svc = workflowService as unknown as { updateProjectStatus?: unknown }
const original = svc.updateProjectStatus

function seed(status: string, myRole = 'OWNER') {
  const info = { id: '7', name: 'P', description: '', status, ownerId: '2', myRole, createdAt: '', updatedAt: '' } as unknown as ProjectSettingsDto
  const publishProject = vi.fn(async () => true)
  const loadProject = vi.fn(async () => {})
  const loadPhases = vi.fn(async () => {})
  useWorkflowStore.setState((s) => ({
    currentProjectId: '7',
    loadPhases,
    project: { ...s.project, projectId: '7', info, loadProject },
    settings: { ...s.settings, settings: null, kahnCycleErrors: null, publishProject },
  }))
  return { publishProject, loadProject, loadPhases }
}

describe('ProjectStatusControl', () => {
  afterEach(() => {
    cleanup()
    svc.updateProjectStatus = original
    vi.restoreAllMocks()
  })

  it('nút theo trạng thái: DRAFT/PLANNING Start · ACTIVE Pause, Complete · PAUSED Resume, Complete · COMPLETED Reopen', () => {
    const labels = (s: string) => actionsForStatus(s).map((a) => a.label)
    expect(labels('DRAFT')).toEqual(['Start project'])
    expect(labels('PLANNING')).toEqual(['Start project'])
    expect(labels('ACTIVE')).toEqual(['Pause', 'Mark completed'])
    expect(labels('PAUSED')).toEqual(['Resume', 'Mark completed'])
    expect(labels('COMPLETED')).toEqual(['Reopen project'])
    expect(labels('ARCHIVED')).toEqual([])
  })

  it('DRAFT: Start project -> xác nhận -> publish dự án đang mở, rồi tải lại thông tin dự án và đồ thị', async () => {
    const { publishProject, loadProject, loadPhases } = seed('DRAFT')
    render(<ProjectStatusControl projectId="7" />)

    fireEvent.click(screen.getByRole('button', { name: /Start project/ }))
    expect(publishProject).not.toHaveBeenCalled() // phải xác nhận trước
    const buttons = screen.getAllByRole('button', { name: 'Start project' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(publishProject).toHaveBeenCalledWith('7'))
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith('7'))
    expect(loadPhases).toHaveBeenCalledWith('7')
  })

  it('ACTIVE: Pause -> xác nhận -> PATCH trạng thái PAUSED', async () => {
    seed('ACTIVE')
    const update = vi.fn(async () => ({}))
    svc.updateProjectStatus = update
    render(<ProjectStatusControl projectId="7" />)

    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    const buttons = screen.getAllByRole('button', { name: 'Pause' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(update).toHaveBeenCalledWith('7', 'PAUSED'))
  })

  it('COMPLETED: Reopen project -> ACTIVE', async () => {
    seed('COMPLETED')
    const update = vi.fn(async () => ({}))
    svc.updateProjectStatus = update
    render(<ProjectStatusControl projectId="7" />)

    fireEvent.click(screen.getByRole('button', { name: /Reopen project/ }))
    const buttons = screen.getAllByRole('button', { name: 'Reopen project' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(update).toHaveBeenCalledWith('7', 'ACTIVE'))
  })

  it('không phải chủ dự án: chỉ thấy nhãn trạng thái, không có nút', () => {
    seed('ACTIVE', 'MANAGER')
    render(<ProjectStatusControl projectId="7" />)
    const box = screen.getByTestId('project-status-control')
    expect(within(box).queryAllByRole('button')).toHaveLength(0)
    expect(within(box).getByText('ACTIVE')).toBeDefined()
  })
})

