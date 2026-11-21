// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodePropertiesModal } from '../NodePropertiesModal'
import type { BranchGraphNode } from '../../../types/workflow.types'

function makeNode(over: Partial<BranchGraphNode> = {}): BranchGraphNode {
  return {
    id: 'n-1',
    kind: 'branch',
    code: 'WPE-001',
    title: 'Design API',
    description: '',
    isTrack: false,
    status: 'TODO',
    assignee: null,
    due: '2099-12-01',
    blocker: null,
    joinPolicy: 'ALL_COMPLETED',
    parentIds: ['root'],
    ...over,
  }
}

describe('NodePropertiesModal — khóa ô hạn chót', () => {
  afterEach(() => {
    cleanup()
  })

  it('khóa ô hạn với title phù hợp khi task DONE có hạn', () => {
    render(
      <NodePropertiesModal
        node={makeNode({ status: 'DONE', due: '2099-12-01' })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('Due date') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.title).toBe('Task is done — due date locked')
  })

  it('khóa ô hạn với title phù hợp khi hạn đã qua', () => {
    render(
      <NodePropertiesModal
        node={makeNode({ status: 'IN_PROGRESS', due: '2020-01-10' })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const input = screen.getByLabelText('Due date') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.title).toBe('Due date passed — locked so the late record stays accurate')
  })

  it('khóa ô hạn khi task DONE không có hạn (backend chặn đặt hạn cho task đã xong), mở khi hạn còn ở tương lai', () => {
    const { rerender } = render(
      <NodePropertiesModal
        node={makeNode({ status: 'DONE', due: null })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    expect((screen.getByLabelText('Due date') as HTMLInputElement).disabled).toBe(true)

    rerender(
      <NodePropertiesModal
        node={makeNode({ status: 'TODO', due: '2099-12-01' })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    const futureInput = screen.getByLabelText('Due date') as HTMLInputElement
    expect(futureInput.disabled).toBe(false)
    expect(futureInput.title).toBe('')
  })
})
