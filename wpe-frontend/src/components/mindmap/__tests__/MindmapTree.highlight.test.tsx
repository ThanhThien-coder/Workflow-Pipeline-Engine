// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MindmapTree } from '../MindmapTree'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { BranchGraphNode, GraphNodeMap, RootGraphNode } from '../../../types/workflow.types'
import { W, TASK_H } from '../../../utils/spanningTreeLayout'

const fitToBounds = vi.fn((..._args: unknown[]) => true)
vi.mock('../../../hooks/usePanZoom', () => ({
  usePanZoom: () => ({
    viewportRef: { current: null },
    contentRef: { current: null },
    scale: 1,
    pan: { x: 0, y: 0 },
    setPan: vi.fn(),
    transform: { transform: 'none', transformOrigin: '0 0' },
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onMouseLeave: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    fitToBounds,
  }),
}))

const nodes = (): GraphNodeMap => ({
  root: { kind: 'root', id: 'root', title: 'Root', parentIds: [] } as RootGraphNode,
  trk: {
    kind: 'branch', id: 'trk', code: 'TRK-1', title: 'Track', isTrack: true, status: 'TODO', parentIds: ['root'],
    parentId: 'root', trackId: 'trk', level: 1, order: 0, description: '', assignee: null, due: null, blocker: null,
    joinPolicy: null, width: W.track, height: 58,
  } as BranchGraphNode,
  t1: {
    kind: 'branch', id: 't1', code: 'WPE-1', title: 'Task one', isTrack: false, status: 'TODO', parentIds: ['trk'],
    parentId: 'trk', trackId: 'trk', level: 2, order: 0, description: '', assignee: null, due: null, blocker: null,
    joinPolicy: null, width: W.task, height: TASK_H,
  } as BranchGraphNode,
})

describe('MindmapTree: làm nổi task từ ô tìm kiếm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fitToBounds.mockClear()
    useWorkflowStore.getState().ui.setHighlightNodeId(null)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('có highlightNodeId trong cây: gọi fitToBounds quanh node một lần, hiện viền ~2 giây rồi tắt, xóa highlightNodeId', () => {
    render(<MindmapTree nodes={nodes()} selectedId={null} onSelect={vi.fn()} />)
    // lần fit toàn cây lúc mở phase
    const callsBefore = fitToBounds.mock.calls.length

    act(() => {
      useWorkflowStore.getState().ui.setHighlightNodeId('t1')
    })

    expect(fitToBounds.mock.calls.length).toBe(callsBefore + 1)
    const [bounds, options] = fitToBounds.mock.calls[callsBefore] as unknown as [
      { minX: number; maxX: number },
      { maxScale: number },
    ]
    expect(bounds.maxX).toBeGreaterThan(bounds.minX)
    expect(options.maxScale).toBe(1)
    expect(useWorkflowStore.getState().ui.highlightNodeId).toBeNull()
    expect(screen.getByTestId('node-highlight')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.queryByTestId('node-highlight')).toBeNull()
    expect(fitToBounds.mock.calls.length).toBe(callsBefore + 1)
  })

  it('highlightNodeId không thuộc cây này thì không zoom và giữ nguyên để cây đúng xử lý', () => {
    render(<MindmapTree nodes={nodes()} selectedId={null} onSelect={vi.fn()} />)
    const callsBefore = fitToBounds.mock.calls.length
    act(() => {
      useWorkflowStore.getState().ui.setHighlightNodeId('khong-co')
    })
    expect(fitToBounds.mock.calls.length).toBe(callsBefore)
    expect(useWorkflowStore.getState().ui.highlightNodeId).toBe('khong-co')
    expect(screen.queryByTestId('node-highlight')).toBeNull()
  })
})
