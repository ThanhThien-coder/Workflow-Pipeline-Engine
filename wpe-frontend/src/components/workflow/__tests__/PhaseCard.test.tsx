// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhaseCard } from '../PhaseCard'
import { CreatePhaseModal } from '../CreatePhaseModal'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { MacroPhase } from '../../../types/workflow.types'

function phase(over: Partial<MacroPhase> = {}): MacroPhase {
  return { id: 'p1', name: 'PHASE 3', sub: 'Deploy to prod', status: 'TODO', pct: 0, accent: 'blue', w: 380, h: 180, parentPhaseIds: [], ...over }
}

const baseProps = { position: { x: 40, y: 60 }, selected: false, onClick: vi.fn(), onSpawnDown: vi.fn() }

describe('PhaseCard — tên phase (TASK_72)', () => {
  const originalRename = useWorkflowStore.getState().renamePhase
  let renamePhase: Mock<(phaseId: string, name: string) => Promise<void>>

  beforeEach(() => {
    renamePhase = vi.fn<(phaseId: string, name: string) => Promise<void>>().mockResolvedValue(undefined)
    useWorkflowStore.setState({ renamePhase, phaseToRename: null })
  })
  afterEach(() => {
    cleanup()
    useWorkflowStore.setState({ renamePhase: originalRename, phaseToRename: null })
  })

  it('chỉ hiện MỘT tên có nghĩa, không hiện "PHASE 3"', () => {
    render(<PhaseCard {...baseProps} phase={phase()} />)
    expect(screen.queryByText('PHASE 3')).toBeNull()
    expect(screen.getByText('Deploy to prod')).toBeDefined()
  })

  it('nhấp đúp vào tên thì hiện ô nhập, Enter lưu bằng renamePhase', () => {
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} />)
    fireEvent.doubleClick(screen.getByText('Build'))

    const input = screen.getByLabelText('Phase name') as HTMLInputElement
    expect(input.value).toBe('Build')
    fireEvent.change(input, { target: { value: '  Release  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(renamePhase).toHaveBeenCalledTimes(1)
    expect(renamePhase).toHaveBeenCalledWith('p1', 'Release')
    expect(screen.queryByLabelText('Phase name')).toBeNull()
  })

  it('nút bút chì mở ô nhập; blur cũng lưu nhưng không lưu hai lần sau Enter', () => {
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename phase' }))
    const input = screen.getByLabelText('Phase name')
    fireEvent.change(input, { target: { value: 'Ship' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(renamePhase).toHaveBeenCalledTimes(1)
  })

  it('Esc hủy, tên rỗng hoặc không đổi thì không lưu', () => {
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} />)

    fireEvent.doubleClick(screen.getByText('Build'))
    fireEvent.change(screen.getByLabelText('Phase name'), { target: { value: 'Other' } })
    fireEvent.keyDown(screen.getByLabelText('Phase name'), { key: 'Escape' })
    expect(renamePhase).not.toHaveBeenCalled()

    fireEvent.doubleClick(screen.getByText('Build'))
    fireEvent.change(screen.getByLabelText('Phase name'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByLabelText('Phase name'), { key: 'Enter' })
    expect(renamePhase).not.toHaveBeenCalled()

    fireEvent.doubleClick(screen.getByText('Build'))
    fireEvent.keyDown(screen.getByLabelText('Phase name'), { key: 'Enter' })
    expect(renamePhase).not.toHaveBeenCalled()
  })

  it('lỗi lưu tên thì báo qua onRenameError', async () => {
    const boom = new Error('403')
    renamePhase.mockRejectedValueOnce(boom)
    const onRenameError = vi.fn()
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} onRenameError={onRenameError} />)
    fireEvent.doubleClick(screen.getByText('Build'))
    fireEvent.change(screen.getByLabelText('Phase name'), { target: { value: 'New' } })
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Phase name'), { key: 'Enter' })
    })
    expect(onRenameError).toHaveBeenCalledWith(boom)
  })

  it('ô nhập chặn mousedown để không kéo thẻ', () => {
    const onDragCardStart = vi.fn()
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} onDragCardStart={onDragCardStart} />)
    fireEvent.doubleClick(screen.getByText('Build'))
    fireEvent.mouseDown(screen.getByLabelText('Phase name'))
    expect(onDragCardStart).not.toHaveBeenCalled()
  })

  it('phaseToRename trùng id thì tự bật ô nhập, chọn sẵn chữ và xóa cờ', () => {
    useWorkflowStore.setState({ phaseToRename: 'p1' })
    render(<PhaseCard {...baseProps} phase={phase({ name: 'New phase', sub: '' })} />)

    const input = screen.getByLabelText('Phase name') as HTMLInputElement
    expect(input.value).toBe('New phase')
    expect(useWorkflowStore.getState().phaseToRename).toBeNull()
  })

  it('chỉ xem (readOnly): không có bút chì, nhấp đúp không bật ô nhập', () => {
    render(<PhaseCard {...baseProps} phase={phase({ name: 'Build', sub: '' })} readOnly />)
    expect(screen.queryByRole('button', { name: 'Rename phase' })).toBeNull()
    fireEvent.doubleClick(screen.getByText('Build'))
    expect(screen.queryByLabelText('Phase name')).toBeNull()
  })

  it('thanh màu nằm trong lớp bo góc cắt phần thừa, thẻ vẫn overflow-visible cho cổng nối', () => {
    const { container } = render(<PhaseCard {...baseProps} phase={phase()} />)
    const clip = container.querySelector('[data-accent-clip]') as HTMLElement
    expect(clip.className).toContain('overflow-hidden')
    expect(clip.className).toContain('rounded-[15px]')
    expect(clip.className).toContain('inset-0')
    expect(clip.className).toContain('pointer-events-none')
    expect((container.querySelector('[data-phase-id="p1"][role="button"]') as HTMLElement).className).toContain('overflow-visible')
  })
})

describe('CreatePhaseModal (TASK_72)', () => {
  afterEach(() => cleanup())

  it('chỉ còn ô tên, không còn ô Subtitle; gửi sub rỗng', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CreatePhaseModal phases={[phase()]} onSubmit={onSubmit} onClose={vi.fn()} />)

    expect(screen.queryByText(/Subtitle/i)).toBeNull()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Ops ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Phase' }))
    })
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ops', sub: '', parentPhaseId: undefined })
  })

  it('tên rỗng thì báo lỗi, không gửi; ô Prerequisite dùng tên hiển thị', async () => {
    const onSubmit = vi.fn()
    render(<CreatePhaseModal phases={[phase()]} onSubmit={onSubmit} onClose={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Deploy to prod' })).toBeDefined()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Phase' }))
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Please enter a phase name.')).toBeDefined()
  })
})
