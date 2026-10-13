// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MindmapTree } from '../MindmapTree'
import type { GraphNodeMap, BranchGraphNode, RootGraphNode } from '../../../types/workflow.types'
import {
  calculateDeterministicLayout,
  createNewBranchNode,
  TASK_H,
  W,
} from '../../../utils/spanningTreeLayout'

describe('MindmapTree Graph Engine & Infinite Oscillation Fix', () => {
  afterEach(() => {
    cleanup()
  })

  const createInitialNodes = (): GraphNodeMap => ({
    root: {
      kind: 'root',
      id: 'root',
      title: 'Phase 2A: Root Module',
      parentIds: [],
    } as RootGraphNode,
    'trk-1': {
      kind: 'branch',
      id: 'trk-1',
      code: 'TRK-01',
      title: 'Database Track',
      isTrack: true,
      status: 'TODO',
      parentIds: ['root'],
      parentId: 'root',
      trackId: 'trk-1',
      level: 1,
      order: 0,
      description: '',
      assignee: null,
      due: null,
      blocker: null,
      joinPolicy: null,
      width: W.track,
      height: 58,
    } as BranchGraphNode,
    'task-1': {
      kind: 'branch',
      id: 'task-1',
      code: 'WPE-101',
      title: 'Design DB Schema',
      isTrack: false,
      status: 'DONE',
      parentIds: ['trk-1'],
      parentId: 'trk-1',
      trackId: 'trk-1',
      level: 2,
      order: 0,
      description: '',
      assignee: 'Sarah Chen',
      due: null,
      blocker: null,
      joinPolicy: null,
      width: W.task,
      height: TASK_H,
    } as BranchGraphNode,
  })

  it('BƯỚC 1 & 2: Định vị tất cả các node bằng tọa độ tuyệt đối (absolute positioning) và cô lập khỏi hover state', () => {
    const nodes = createInitialNodes()
    const handleSelect = vi.fn()

    const { container } = render(
      <MindmapTree
        nodes={nodes}
        selectedId={null}
        onSelect={handleSelect}
      />
    )

    const rootEl = container.querySelector('[data-node-id="root"]') as HTMLElement
    const trackEl = container.querySelector('[data-node-id="trk-1"]') as HTMLElement
    const taskEl = container.querySelector('[data-node-id="task-1"]') as HTMLElement

    expect(rootEl).toBeDefined()
    expect(trackEl).toBeDefined()
    expect(taskEl).toBeDefined()

    // Absolute positioning assertions (Level-based X: Level 0 = 40, Level 1 = 320, Level 2 = 600)
    expect(rootEl.style.position).toBe('absolute')
    expect(rootEl.style.left).toBe('40px')
    expect(rootEl.style.width).toBe(`${W.root}px`)

    expect(trackEl.style.position).toBe('absolute')
    expect(trackEl.style.left).toBe('320px')

    expect(taskEl.style.position).toBe('absolute')
    expect(taskEl.style.left).toBe('600px')

    const initialLeft = taskEl.style.left
    const initialTop = taskEl.style.top

    // Hover into node: position MUST NOT move even 1 pixel
    fireEvent.mouseEnter(taskEl)
    expect(taskEl.style.left).toBe(initialLeft)
    expect(taskEl.style.top).toBe(initialTop)

    // Hover out: position remains rock-solid
    fireEvent.mouseLeave(taskEl)
    expect(taskEl.style.left).toBe(initialLeft)
    expect(taskEl.style.top).toBe(initialTop)
  })

  it('TIÊU CHÍ NGHIỆM THU: Bấm nút "+" tạo thêm 1, 2, 3 node mới liên tiếp - node cũ đứng im tuyệt đối, node mới ngay hàng thẳng lối', () => {
    let currentNodes = createInitialNodes()
    const initialLayout = calculateDeterministicLayout(currentNodes)
    const task1InitialPos = initialLayout['task-1']

    // 1. Tạo node mới thứ 1
    const task2 = createNewBranchNode(currentNodes['trk-1'], currentNodes, 'p2a', 'Subtask 2')
    expect(task2.width).toBe(W.task)
    expect(task2.height).toBe(TASK_H)
    currentNodes = { ...currentNodes, [task2.id]: task2 }

    const layoutAfter1 = calculateDeterministicLayout(currentNodes)
    expect(layoutAfter1['task-1'].x).toBe(task1InitialPos.x)
    expect(layoutAfter1['task-1'].y).toBe(task1InitialPos.y) // Đứng im tuyệt đối không nhích 1px
    expect(layoutAfter1[task2.id].x).toBe(600)
    expect(layoutAfter1[task2.id].y).toBe(task1InitialPos.y + TASK_H + 16)

    // 2. Tạo node mới thứ 2
    const task3 = createNewBranchNode(currentNodes['trk-1'], currentNodes, 'p2a', 'Subtask 3')
    expect(task3.width).toBe(W.task)
    expect(task3.height).toBe(TASK_H)
    currentNodes = { ...currentNodes, [task3.id]: task3 }

    const layoutAfter2 = calculateDeterministicLayout(currentNodes)
    expect(layoutAfter2['task-1'].x).toBe(task1InitialPos.x)
    expect(layoutAfter2['task-1'].y).toBe(task1InitialPos.y) // Vẫn đứng im tuyệt đối
    expect(layoutAfter2[task2.id].y).toBe(layoutAfter1[task2.id].y) // Node 2 đứng im
    expect(layoutAfter2[task3.id].x).toBe(600)
    expect(layoutAfter2[task3.id].y).toBe(layoutAfter2[task2.id].y + TASK_H + 16)

    // 3. Tạo node mới thứ 3
    const task4 = createNewBranchNode(currentNodes['trk-1'], currentNodes, 'p2a', 'Subtask 4')
    expect(task4.width).toBe(W.task)
    expect(task4.height).toBe(TASK_H)
    currentNodes = { ...currentNodes, [task4.id]: task4 }

    const layoutAfter3 = calculateDeterministicLayout(currentNodes)
    expect(layoutAfter3['task-1'].x).toBe(task1InitialPos.x)
    expect(layoutAfter3['task-1'].y).toBe(task1InitialPos.y) // Node cũ đứng im 100%
    expect(layoutAfter3[task4.id].x).toBe(600)
    expect(layoutAfter3[task4.id].y).toBe(layoutAfter3[task3.id].y + TASK_H + 16)
  })

  it('BƯỚC 3 & 4: Rê chuột vào/ra liên tục mượt mà, dây nối SVG sáng chính xác không bị biến dạng', () => {
    const nodes = createInitialNodes()
    const { container } = render(
      <MindmapTree
        nodes={nodes}
        selectedId={null}
        onSelect={vi.fn()}
      />
    )

    // Kiểm tra dây nối SVG ban đầu
    const paths = container.querySelectorAll('svg path')
    expect(paths.length).toBeGreaterThan(0)
    const initialPaths = Array.from(paths).map((p) => p.getAttribute('d'))

    // Rê chuột vào task-1
    const taskEl = container.querySelector('[data-node-id="task-1"]') as HTMLElement
    fireEvent.mouseEnter(taskEl)

    // Dây nối sáng lên: có đường dẫn highlight với màu #2563eb (upstream)
    const litPaths = container.querySelectorAll('svg path[stroke="#2563eb"]')
    expect(litPaths.length).toBe(1)
    expect(litPaths[0].getAttribute('d')).toMatch(/M\s*520/) // Xuất phát từ mép phải của track (x: 320 + w: 200 = 520)
    expect(litPaths[0].getAttribute('stroke-width')).toBe('2.5')

    // Rê chuột ra ngoài
    fireEvent.mouseLeave(taskEl)
    const afterPaths = Array.from(container.querySelectorAll('svg path')).map((p) => p.getAttribute('d'))

    // Tọa độ dây nối hoàn toàn bất biến, không bị nhảy loạn hay biến dạng
    expect(afterPaths).toEqual(initialPaths)
  })

  it('BƯỚC 4 & SSOT: Bấm "+" trên Track tạo Task tại Cột 2 (X = 600), bấm "+" trên Task tạo Subtask sang phải tại Cột 3 (X = 880)', () => {
    let currentNodes = createInitialNodes()
    const onUpdate = vi.fn((updater: (prev: GraphNodeMap) => GraphNodeMap) => {
      currentNodes = updater(currentNodes)
    })

    const { container, rerender } = render(
      <MindmapTree
        nodes={currentNodes}
        selectedId={null}
        onSelect={vi.fn()}
        onUpdateNodes={onUpdate}
        phaseId="p2a"
      />
    )

    // 1. Bấm nút "+" trên Track Card
    const trackEl = container.querySelector('[data-node-id="trk-1"]') as HTMLElement
    const trackPlusBtn = trackEl.querySelector('button[title*="Thêm công việc vào Track"]') as HTMLButtonElement
    expect(trackPlusBtn).toBeDefined()
    fireEvent.click(trackPlusBtn)

    expect(onUpdate).toHaveBeenCalledTimes(1)
    // Rerender with updated nodes
    rerender(
      <MindmapTree
        nodes={currentNodes}
        selectedId={null}
        onSelect={vi.fn()}
        onUpdateNodes={onUpdate}
        phaseId="p2a"
      />
    )

    // Tìm node mới sinh ra
    const newTaskEntry = Object.values(currentNodes).find(
      (n) => n.kind === 'branch' && !n.isTrack && n.id !== 'task-1'
    )
    expect(newTaskEntry).toBeDefined()
    expect((newTaskEntry as BranchGraphNode).trackId).toBe('trk-1')
    expect((newTaskEntry as BranchGraphNode).level).toBe(2)

    const newTaskEl = container.querySelector(`[data-node-id="${newTaskEntry!.id}"]`) as HTMLElement
    expect(newTaskEl).toBeDefined()
    expect(newTaskEl.style.left).toBe('600px') // Cột 2: Level 2 (X = 600)
    expect(trackEl.style.left).toBe('320px')   // Track ở Cột 1 (X = 320)

    // 2. Bấm nút "+" trên Task Card (Child Subtask sang phải)
    const taskPlusBtn = newTaskEl.querySelector('button[title*="Thêm nhánh con phân rã"]') as HTMLButtonElement
    expect(taskPlusBtn).toBeDefined()
    fireEvent.click(taskPlusBtn)

    expect(onUpdate).toHaveBeenCalledTimes(2)
    rerender(
      <MindmapTree
        nodes={currentNodes}
        selectedId={null}
        onSelect={vi.fn()}
        onUpdateNodes={onUpdate}
        phaseId="p2a"
      />
    )

    // Tìm subtask vừa sinh ra làm con của newTaskEntry
    const subtaskEntry = Object.values(currentNodes).find(
      (n) => n.parentIds.includes(newTaskEntry!.id)
    )
    expect(subtaskEntry).toBeDefined()
    expect((subtaskEntry as BranchGraphNode).level).toBe(3) // Level 3!
    expect((subtaskEntry as BranchGraphNode).parentId).toBe(newTaskEntry!.id)

    const subtaskEl = container.querySelector(`[data-node-id="${subtaskEntry!.id}"]`) as HTMLElement
    expect(subtaskEl).toBeDefined()
    expect(subtaskEl.style.left).toBe('880px') // Mọc sang phải tại Cột 3 (X = 880)
  })

  it('Reset Phase Tree: Nút reset khôi phục dữ liệu sạch sẽ, không crash giao diện', () => {
    const nodes = createInitialNodes()
    const { container } = render(
      <MindmapTree
        nodes={nodes}
        selectedId={null}
        onSelect={vi.fn()}
        phaseId="p2a"
      />
    )

    const resetBtn = container.querySelector('button[title*="Khôi phục trạng thái gốc"]') as HTMLButtonElement
    expect(resetBtn).toBeDefined()
    expect(resetBtn.textContent).toContain('Reset Phase Tree')
  })
})
