// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MindmapTree } from '../MindmapTree'
import type { BranchGraphNode, GraphNodeMap, RootGraphNode } from '../../../types/workflow.types'

/** T3 (G7) — chế độ API: thêm task con và đổi tên trên thẻ gọi hàm API, không tạo/sửa node tạm cục bộ. */

const TASK: BranchGraphNode = {
  kind: 'branch', id: '2', code: 'WPE-002', title: 'Thiết kế API', description: '', isTrack: false,
  status: 'TODO', assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root_20'],
}
const NODES: GraphNodeMap = {
  root_20: { id: 'root_20', kind: 'root', title: 'PHASE 2', parentIds: [] } as RootGraphNode,
  '2': TASK,
}

function renameTo(value: string) {
  fireEvent.doubleClick(screen.getByText('Thiết kế API'))
  const input = screen.getByPlaceholderText('Task title…')
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.blur(input)
}

describe('MindmapTree — ghi qua API', () => {
  afterEach(() => cleanup())

  it('nút thêm task con gọi onAddChildTask, không sửa cây cục bộ', () => {
    const onAddChildTask = vi.fn()
    const onUpdateNodes = vi.fn()
    render(<MindmapTree nodes={NODES} selectedId={null} onSelect={() => {}} onUpdateNodes={onUpdateNodes} onAddChildTask={onAddChildTask} phaseId="20" />)

    fireEvent.click(screen.getByTitle('Add child task (Thêm nhánh con phân rã)'))

    expect(onAddChildTask).toHaveBeenCalledWith('2')
    expect(onUpdateNodes).not.toHaveBeenCalled()
  })

  it('đổi tên trên thẻ gọi onRenameNode đúng một lần (Enter rồi blur), không sửa cây cục bộ', () => {
    const onRenameNode = vi.fn()
    const onUpdateNodes = vi.fn()
    render(<MindmapTree nodes={NODES} selectedId={null} onSelect={() => {}} onUpdateNodes={onUpdateNodes} onRenameNode={onRenameNode} phaseId="20" />)

    renameTo('  Thiết kế API v2  ')

    expect(onRenameNode).toHaveBeenCalledTimes(1)
    expect(onRenameNode).toHaveBeenCalledWith('2', 'Thiết kế API v2')
    expect(onUpdateNodes).not.toHaveBeenCalled()
  })

  it('tên không đổi hoặc để trống thì không lưu', () => {
    const onRenameNode = vi.fn()
    render(<MindmapTree nodes={NODES} selectedId={null} onSelect={() => {}} onRenameNode={onRenameNode} phaseId="20" />)

    renameTo('Thiết kế API')
    renameTo('   ')

    expect(onRenameNode).not.toHaveBeenCalled()
  })

  it('chế độ mock (không có onRenameNode): đổi tên sửa cây cục bộ, trước đây tên mới bị bỏ', () => {
    const onUpdateNodes = vi.fn()
    render(<MindmapTree nodes={NODES} selectedId={null} onSelect={() => {}} onUpdateNodes={onUpdateNodes} phaseId="20" />)

    renameTo('Tên mới')

    expect(onUpdateNodes).toHaveBeenCalledTimes(1)
    const updated = onUpdateNodes.mock.calls[0][0](NODES) as GraphNodeMap
    expect(updated['2'].title).toBe('Tên mới')
  })
})
