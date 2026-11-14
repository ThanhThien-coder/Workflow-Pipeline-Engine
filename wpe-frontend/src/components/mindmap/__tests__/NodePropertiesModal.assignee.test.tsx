// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NodePropertiesModal } from '../NodePropertiesModal'
import type { BranchGraphNode } from '../../../types/workflow.types'
import type { UserSummary } from '../../../types/kanban.types'

/** T1 (G9) — ô Người làm chỉ có thành viên thật, chọn theo id, có "Chưa giao". */

function node(assignee: string | null): BranchGraphNode {
  return {
    kind: 'branch', id: '152', code: 'WPE-152', title: 'Subtask 1', description: '', isTrack: false,
    status: 'LOCKED', assignee, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root'],
  }
}

function member(id: string, name: string): UserSummary {
  return { id, name, roleTitle: 'OWNER', initials: name.slice(0, 2).toUpperCase(), avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0 }
}

function assigneeSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: /assignee|người làm/i }) as HTMLSelectElement
}

describe('NodePropertiesModal — người làm', () => {
  afterEach(() => cleanup())

  it('chỉ liệt kê thành viên thật và "Chưa giao", không còn tên giả', () => {
    render(<NodePropertiesModal node={node(null)} members={[member('9', 'a')]} onClose={() => {}} onDelete={() => {}} />)

    const labels = Array.from(assigneeSelect().options).map((o) => o.textContent)
    expect(labels).toEqual(['Chưa giao', 'a'])
    expect(assigneeSelect().value).toBe('')
  })

  it('chọn sẵn đúng người theo id và lưu id người được chọn', () => {
    const onSave = vi.fn()
    render(
      <NodePropertiesModal
        node={node('9')}
        members={[member('9', 'a'), member('12', 'b')]}
        onClose={() => {}}
        onDelete={() => {}}
        onSave={onSave}
      />,
    )
    expect(assigneeSelect().value).toBe('9')

    fireEvent.change(assigneeSelect(), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes|lưu/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assignee: '12' }))
  })

  it('chọn "Chưa giao" thì lưu null', () => {
    const onSave = vi.fn()
    render(<NodePropertiesModal node={node('9')} members={[member('9', 'a')]} onClose={() => {}} onDelete={() => {}} onSave={onSave} />)

    fireEvent.change(assigneeSelect(), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes|lưu/i }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assignee: null }))
  })
})
