// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MindmapTree } from '../MindmapTree'
import type { BranchGraphNode, GhostGraphNode, GraphNodeMap, RootGraphNode } from '../../../types/workflow.types'

/** TASK_73 — cổng nối, gỡ dây, ghost bên trái, root ẩn, fit, nhãn quá hạn. */

const task = (id: string, parentIds: string[], extra: Partial<BranchGraphNode> = {}): BranchGraphNode => ({
  kind: 'branch', id, code: `WPE-${id}`, title: `Task ${id}`, description: '', isTrack: false,
  status: 'TODO', assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds, ...extra,
})
const ROOT: RootGraphNode = { id: 'root_20', kind: 'root', title: 'PHASE 2', parentIds: [] }
const GHOST: GhostGraphNode = {
  id: 'ghost_9_to_B', kind: 'ghost', refPhase: '5', refId: '9', dir: 'up', targetTaskId: 'B', title: 'Upstream', parentIds: [],
}

/** A và B đều ở cột đầu (không có cha trong phase). */
const TWO_TASKS: GraphNodeMap = { root_20: ROOT, A: task('A', ['root_20']), B: task('B', ['root_20']) }
/** B phụ thuộc A (dây A → B) và có ghost 9 (dây ghost → B). */
const LINKED: GraphNodeMap = { root_20: ROOT, A: task('A', ['root_20']), B: task('B', ['A']), ghost_9_to_B: GHOST }

describe('MindmapTree — root ẩn', () => {
  afterEach(() => cleanup())

  it('không vẽ thẻ root và không có dây từ root', () => {
    const { container } = render(<MindmapTree nodes={{ root_20: ROOT, A: task('A', ['root_20']) }} selectedId={null} onSelect={() => {}} phaseId="20" />)

    expect(container.querySelector('[data-node-id="root_20"]')).toBeNull()
    expect(screen.queryByText('Root')).toBeNull()
    // Lớp dây nối là svg.overflow-visible (icon lucide cũng là svg nên không đếm chung)
    expect(container.querySelectorAll('svg.overflow-visible path')).toHaveLength(0)
    // Task không có cha trong phase là cột đầu tiên, canh trái
    expect((container.querySelector('[data-node-id="A"]') as HTMLElement).style.left).toBe('40px')
  })

  it('nút thêm task ghi "+ Add task"', () => {
    render(<MindmapTree nodes={TWO_TASKS} selectedId={null} onSelect={() => {}} onAddRootTask={() => {}} phaseId="20" />)
    expect(screen.getByRole('button', { name: /add task/i })).toBeDefined()
    expect(screen.queryByText(/root task/i)).toBeNull()
  })
})

describe('MindmapTree — ghost là cha nằm bên trái', () => {
  afterEach(() => cleanup())

  it('ghost nằm bên trái task đích', () => {
    const { container } = render(<MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} phaseId="20" />)
    const ghostEl = container.querySelector('[data-node-id="ghost_9_to_B"]') as HTMLElement
    const taskEl = container.querySelector('div[data-node-id="B"]') as HTMLElement
    const ghostRight = parseFloat(ghostEl.style.left) + parseFloat(ghostEl.style.width)
    expect(ghostRight).toBeLessThanOrEqual(parseFloat(taskEl.style.left))
  })
})

describe('MindmapTree — cổng nối kéo task', () => {
  const originalElementFromPoint = document.elementFromPoint

  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    cleanup()
    document.elementFromPoint = originalElementFromPoint
  })

  it('kéo từ cổng của A thả lên B gọi onConnectNodes("A", "B")', () => {
    const onConnectNodes = vi.fn()
    const { container } = render(
      <MindmapTree nodes={TWO_TASKS} selectedId={null} onSelect={() => {}} onConnectNodes={onConnectNodes} phaseId="20" />,
    )
    const cardA = container.querySelector('[data-node-id="A"]') as HTMLElement
    const cardB = container.querySelector('[data-node-id="B"]') as HTMLElement
    const port = within(cardA).getByTitle('Drag to another task to make it depend on this one')
    document.elementFromPoint = vi.fn(() => cardB)

    fireEvent.mouseDown(port, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 200, clientY: 200 })
    fireEvent.mouseUp(window, { clientX: 200, clientY: 200 })

    expect(onConnectNodes).toHaveBeenCalledTimes(1)
    expect(onConnectNodes).toHaveBeenCalledWith('A', 'B')
  })

  it('bấm cổng mà không kéo thì không nối và không thêm task', () => {
    const onConnectNodes = vi.fn()
    const onAddChildTask = vi.fn()
    const onUpdateNodes = vi.fn()
    const { container } = render(
      <MindmapTree nodes={TWO_TASKS} selectedId={null} onSelect={() => {}} onConnectNodes={onConnectNodes} onAddChildTask={onAddChildTask} onUpdateNodes={onUpdateNodes} phaseId="20" />,
    )
    const port = within(container.querySelector('[data-node-id="A"]') as HTMLElement).getByTitle('Drag to another task to make it depend on this one')

    fireEvent.mouseDown(port, { clientX: 10, clientY: 10 })
    fireEvent.mouseUp(window, { clientX: 10, clientY: 10 })

    expect(onConnectNodes).not.toHaveBeenCalled()
    expect(onAddChildTask).not.toHaveBeenCalled()
    expect(onUpdateNodes).not.toHaveBeenCalled()
  })

  it('thả ra ngoài task thì không nối', () => {
    const onConnectNodes = vi.fn()
    const { container } = render(
      <MindmapTree nodes={TWO_TASKS} selectedId={null} onSelect={() => {}} onConnectNodes={onConnectNodes} phaseId="20" />,
    )
    const port = within(container.querySelector('[data-node-id="A"]') as HTMLElement).getByTitle('Drag to another task to make it depend on this one')
    document.elementFromPoint = vi.fn(() => document.body)

    fireEvent.mouseDown(port, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(window, { clientX: 300, clientY: 300 })
    fireEvent.mouseUp(window, { clientX: 300, clientY: 300 })

    expect(onConnectNodes).not.toHaveBeenCalled()
  })

  it('ghost cũng có cổng nối; chế độ chỉ xem thì không có cổng', () => {
    const { container, rerender } = render(<MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} phaseId="20" />)
    const ghostCard = container.querySelector('[data-ghost="1"]') as HTMLElement
    expect(within(ghostCard).getByTitle('Drag to another task to make it depend on this one')).toBeDefined()

    rerender(<MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} phaseId="20" readOnly />)
    expect(screen.queryAllByTitle('Drag to another task to make it depend on this one')).toHaveLength(0)
  })

  it('nút (+) chỉ còn là "Add child task", không phải cổng nối', () => {
    const onAddChildTask = vi.fn()
    render(<MindmapTree nodes={TWO_TASKS} selectedId={null} onSelect={() => {}} onAddChildTask={onAddChildTask} phaseId="20" />)
    fireEvent.click(screen.getAllByTitle('Add child task')[0])
    expect(onAddChildTask).toHaveBeenCalledTimes(1)
  })
})

describe('MindmapTree — gỡ dây phụ thuộc', () => {
  afterEach(() => cleanup())

  function openEdgeX(container: HTMLElement, edgeId: string) {
    const hit = container.querySelector(`[data-edge-hit="${edgeId}"]`) as SVGPathElement
    expect(hit).not.toBeNull()
    fireEvent.mouseEnter(hit)
    return screen.getByRole('button', { name: 'Remove dependency' })
  }

  it('rê vào dây task → task hiện ✕, bấm rồi xác nhận gọi onRemoveDependency(nguồn, đích)', () => {
    const onRemoveDependency = vi.fn()
    const { container } = render(
      <MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} onRemoveDependency={onRemoveDependency} phaseId="20" />,
    )

    fireEvent.click(openEdgeX(container, 'edge-A-B'))
    expect(onRemoveDependency).not.toHaveBeenCalled() // còn hỏi xác nhận
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onRemoveDependency).toHaveBeenCalledWith('A', 'B')
  })

  it('hủy xác nhận thì không gỡ', () => {
    const onRemoveDependency = vi.fn()
    const { container } = render(
      <MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} onRemoveDependency={onRemoveDependency} phaseId="20" />,
    )
    fireEvent.click(openEdgeX(container, 'edge-A-B'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRemoveDependency).not.toHaveBeenCalled()
  })

  it('dây ghost → task cũng gỡ được: gọi với id ghost và id task đích', () => {
    const onRemoveDependency = vi.fn()
    const { container } = render(
      <MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} onRemoveDependency={onRemoveDependency} phaseId="20" />,
    )
    fireEvent.click(openEdgeX(container, 'ghost-edge-ghost_9_to_B-B'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemoveDependency).toHaveBeenCalledWith('ghost_9_to_B', 'B')
  })

  it('không có vùng bắt chuột khi chỉ xem hoặc không truyền onRemoveDependency', () => {
    const { container, rerender } = render(<MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} phaseId="20" />)
    expect(container.querySelectorAll('[data-edge-hit]')).toHaveLength(0)

    rerender(<MindmapTree nodes={LINKED} selectedId={null} onSelect={() => {}} onRemoveDependency={() => {}} readOnly phaseId="20" />)
    expect(container.querySelectorAll('[data-edge-hit]')).toHaveLength(0)
  })

  it('dây cấu trúc của track (chế độ mock) không có ✕', () => {
    const track: BranchGraphNode = { ...task('T', ['root_20']), isTrack: true, trackId: 'T' }
    const nodes: GraphNodeMap = { root_20: ROOT, T: track, A: task('A', ['T'], { trackId: 'T' }) }
    const { container } = render(<MindmapTree nodes={nodes} selectedId={null} onSelect={() => {}} onRemoveDependency={() => {}} phaseId="20" />)
    expect(container.querySelectorAll('[data-edge-hit]')).toHaveLength(0)
  })
})

describe('MindmapTree — fit', () => {
  const proto = HTMLElement.prototype
  const widthDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth')
  const heightDesc = Object.getOwnPropertyDescriptor(proto, 'clientHeight')

  beforeEach(() => {
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 1000 })
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 700 })
  })
  afterEach(() => {
    cleanup()
    if (widthDesc) Object.defineProperty(proto, 'clientWidth', widthDesc)
    else delete (proto as unknown as Record<string, unknown>).clientWidth
    if (heightDesc) Object.defineProperty(proto, 'clientHeight', heightDesc)
    else delete (proto as unknown as Record<string, unknown>).clientHeight
  })

  const contentTransform = (container: HTMLElement) =>
    (container.querySelector('[style*="transform-origin"]') as HTMLElement).style.transform

  it('tự fit một lần khi mở, nút bàn tay fit lại sau khi reset', () => {
    const nodes: GraphNodeMap = { root_20: ROOT, A: task('A', ['root_20']) }
    const { container } = render(<MindmapTree nodes={nodes} selectedId={null} onSelect={() => {}} phaseId="20" />)

    // Khung bao của task A: x 40..280, y 60..144 → vừa khung 1000x700, căn giữa, không phóng quá 100%
    expect(contentTransform(container)).toBe('translate(340px, 248px) scale(1)')

    fireEvent.click(screen.getByTitle('Reset to 100%'))
    expect(contentTransform(container)).toBe('translate(0px, 0px) scale(1)')

    fireEvent.click(screen.getByRole('button', { name: 'Fit graph to view' }))
    expect(contentTransform(container)).toBe('translate(340px, 248px) scale(1)')
  })
})

describe('BranchCard — nhãn quá hạn', () => {
  afterEach(() => cleanup())

  it('task quá hạn hiện chip "Overdue"', () => {
    const nodes: GraphNodeMap = { root_20: ROOT, A: task('A', ['root_20'], { isOverdue: true, status: 'IN_PROGRESS' }) }
    render(<MindmapTree nodes={nodes} selectedId={null} onSelect={() => {}} phaseId="20" />)
    expect(screen.getByText('Overdue')).toBeDefined()
  })

  it('task đã DONE hoặc không quá hạn thì không có chip', () => {
    const nodes: GraphNodeMap = {
      root_20: ROOT,
      A: task('A', ['root_20'], { isOverdue: true, status: 'DONE' }),
      B: task('B', ['root_20'], { isOverdue: false }),
    }
    render(<MindmapTree nodes={nodes} selectedId={null} onSelect={() => {}} phaseId="20" />)
    expect(screen.queryByText('Overdue')).toBeNull()
  })
})
