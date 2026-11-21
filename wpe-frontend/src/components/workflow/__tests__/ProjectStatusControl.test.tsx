// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import { ProjectStatusControl, actionsForStatus } from '../ProjectStatusControl'
import type { ProjectSettingsDto } from '../../../types/settings.types'

/** Trạng thái dự án đổi ở màn Workflow: chỉ có Start project (publish) khi DRAFT, chỉ chủ dự án (G34). */

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
    vi.restoreAllMocks()
  })

  it('nút theo trạng thái: chỉ DRAFT có Start project; ACTIVE, ARCHIVED không có nút (G34: không còn Pause/Complete)', () => {
    const labels = (s: string) => actionsForStatus(s).map((a) => a.label)
    expect(labels('DRAFT')).toEqual(['Start project'])
    expect(labels('ACTIVE')).toEqual([])
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

  it('ACTIVE: chủ dự án chỉ thấy nhãn trạng thái, không có nút nào (G34)', () => {
    seed('ACTIVE')
    render(<ProjectStatusControl projectId="7" />)
    const box = screen.getByTestId('project-status-control')
    expect(within(box).queryAllByRole('button')).toHaveLength(0)
    expect(within(box).getByText('ACTIVE')).toBeDefined()
  })

  it('không phải chủ dự án: chỉ thấy nhãn trạng thái, không có nút', () => {
    seed('ACTIVE', 'MANAGER')
    render(<ProjectStatusControl projectId="7" />)
    const box = screen.getByTestId('project-status-control')
    expect(within(box).queryAllByRole('button')).toHaveLength(0)
    expect(within(box).getByText('ACTIVE')).toBeDefined()
  })
})

