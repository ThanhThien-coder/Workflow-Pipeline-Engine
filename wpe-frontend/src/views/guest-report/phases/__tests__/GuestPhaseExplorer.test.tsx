// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import normalFixture from '../../../../domain/__fixtures__/guest-overview-normal.json'
import { buildGuestReport } from '../../../../domain/guestReport'
import type { GuestOverviewDto, GuestReportDto } from '../../../../types/guest.types'
import { GuestPhaseExplorer } from '../../GuestPhaseExplorer'

const normalReport = (normalFixture as unknown as GuestOverviewDto).report as GuestReportDto
const normalModel = buildGuestReport(normalReport)

function ControlledExplorer({
  initialPhaseId = '102',
  initialFocusTaskId = null,
  onCommentTask = vi.fn(),
  onCommentPhase = vi.fn(),
}: {
  initialPhaseId?: string | null
  initialFocusTaskId?: string | null
  onCommentTask?: (taskId: string) => void
  onCommentPhase?: (phaseId: string) => void
}) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(initialPhaseId)
  return (
    <GuestPhaseExplorer
      model={normalModel}
      graph={normalReport.graph}
      selectedPhaseId={selectedPhaseId}
      onSelectPhase={setSelectedPhaseId}
      focusTaskId={initialFocusTaskId}
      onCommentTask={onCommentTask}
      onCommentPhase={onCommentPhase}
    />
  )
}

function switchToListMode() {
  const listBtn = screen.queryByRole('button', { name: 'Task list' })
  if (listBtn) fireEvent.click(listBtn)
  return screen.getByTestId('guest-task-list-panel')
}

describe('GuestPhaseExplorer (Levels A, B, C)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  })

  it('chọn phase thì danh sách task đổi', () => {
    render(<ControlledExplorer initialPhaseId="101" />)
    const listPanel = switchToListMode()

    expect(within(listPanel).getByText('Stakeholder interviews')).toBeTruthy()
    expect(within(listPanel).queryByText('State diagrams')).toBeNull()

    const map = screen.getByTestId('guest-phase-map')
    fireEvent.click(within(map).getByRole('button', { name: /Phase 2.*Design/i }))

    expect(within(listPanel).getByText('State diagrams')).toBeTruthy()
    expect(within(listPanel).queryByText('Stakeholder interviews')).toBeNull()
  })

  it('bộ lọc "Late or overdue" hiển thị đúng số dòng', () => {
    render(<ControlledExplorer initialPhaseId="102" />)
    const listPanel = switchToListMode()

    // Phase 102 (Design) có 6 task, trong đó 2 task là late/overdue: WPE-07 (+4d late) và WPE-09 (overdue 2d)
    expect(listPanel.querySelectorAll('[data-task-code]').length).toBe(6)

    fireEvent.click(within(listPanel).getByRole('button', { name: 'Late or overdue' }))

    const rows = Array.from(listPanel.querySelectorAll('[data-task-code]')).map((el) =>
      el.getAttribute('data-task-code'),
    )
    expect(rows).toEqual(['WPE-07', 'WPE-09'])
  })

  it('focusTaskId mở đúng task và nháy nền ở chế độ danh sách', () => {
    render(<ControlledExplorer initialPhaseId="102" initialFocusTaskId="5009" />)
    const listPanel = switchToListMode()

    expect(within(listPanel).getByText('State machines for a book copy and for a loan.')).toBeTruthy()
    const row = listPanel.querySelector('#guest-task-5009')
    expect(row?.className).toContain('bg-indigo-100/70')
  })

  it('bấm mã task phụ thuộc ở phase khác thì chuyển sang phase đó và mở task', () => {
    render(<ControlledExplorer initialPhaseId="102" initialFocusTaskId="5005" />)
    const listPanel = switchToListMode()

    // WPE-05 (Phase 2) phụ thuộc WPE-04 (Phase 1)
    const depBtn = within(listPanel).getByRole('button', { name: /WPE-04/ })
    fireEvent.click(depBtn)

    // Đã chuyển sang Phase 1 và mở chi tiết WPE-04
    expect(screen.getByText('Phase 1 · Analysis')).toBeTruthy()
    const wpe04Row = listPanel.querySelector('#guest-task-5004')
    expect(wpe04Row?.querySelector('[aria-expanded="true"]')).toBeTruthy()
  })

  it('"Comment on this phase" và Comment của task gọi đúng callback với đúng id', () => {
    const onCommentTask = vi.fn()
    const onCommentPhase = vi.fn()

    render(
      <ControlledExplorer
        initialPhaseId="102"
        initialFocusTaskId="5009"
        onCommentTask={onCommentTask}
        onCommentPhase={onCommentPhase}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Comment on this phase' }))
    expect(onCommentPhase).toHaveBeenCalledTimes(1)
    expect(onCommentPhase).toHaveBeenCalledWith('102')

    const graphPanel = screen.getByTestId('guest-task-graph-panel')
    fireEvent.click(within(graphPanel).getByRole('button', { name: /Comment on this task/i }))
    expect(onCommentTask).toHaveBeenCalledTimes(1)
    expect(onCommentTask).toHaveBeenCalledWith('5009')
  })

  it('hiển thị nhãn Blocks N tasks kèm tooltip liệt kê mã các task bị chặn', () => {
    render(<ControlledExplorer initialPhaseId="102" />)
    const listPanel = switchToListMode()

    const wpe09 = listPanel.querySelector('#guest-task-5009')
    expect(wpe09).toBeTruthy()
    const blocksTag = wpe09?.querySelector('[title*="WPE-19"]')
    expect(blocksTag?.textContent).toContain('Blocks 2 tasks')
    expect(blocksTag?.getAttribute('title')).toContain('WPE-20')
  })

  it('chế độ đồ thị task hiện ghost cards, bật/tắt Other phases và vẽ cạnh blocking màu đỏ', () => {
    render(<ControlledExplorer initialPhaseId="104" />)

    const graphPanel = screen.getByTestId('guest-task-graph-panel')
    // Phase 104 có 4 task LOCKED, phụ thuộc task chưa xong -> có cạnh blocking (data-blocking="true")
    expect(graphPanel.querySelectorAll('[data-blocking="true"]').length).toBeGreaterThan(0)

    // Phase 104 có 4 ghost từ phase khác (<= 10 nên mặc định bật)
    const ghostCheckbox = within(graphPanel).getByRole('checkbox') as HTMLInputElement
    expect(ghostCheckbox.checked).toBe(true)
    expect(graphPanel.querySelectorAll('[data-ghost]').length).toBeGreaterThan(0)

    // Tắt Other phases thì ẩn các thẻ ghost
    fireEvent.click(ghostCheckbox)
    expect(ghostCheckbox.checked).toBe(false)
    expect(graphPanel.querySelectorAll('[data-ghost]').length).toBe(0)
  })

  it('màn hình dưới 640px mặc định mở chế độ Task list', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
    render(<ControlledExplorer initialPhaseId="102" />)

    expect(screen.getByTestId('guest-task-list-panel')).toBeTruthy()
    expect(screen.queryByTestId('guest-task-graph-panel')).toBeNull()
  })
})
