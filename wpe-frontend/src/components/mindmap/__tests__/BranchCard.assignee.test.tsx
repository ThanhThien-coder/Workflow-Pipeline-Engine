// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BranchCard } from '../BranchCard'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { BranchGraphNode } from '../../../types/workflow.types'

/** T1 (G9) — thẻ task hiện tên người làm (tra theo id thành viên thật), không hiện id. */

function node(assignee: string | null): BranchGraphNode {
  return {
    kind: 'branch', id: '152', code: 'WPE-152', title: 'Subtask 1', description: '', isTrack: false,
    status: 'TODO', assignee, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root'],
  }
}

function renderCard(n: BranchGraphNode) {
  const noop = () => {}
  return render(
    <BranchCard
      node={n} nodes={{ [n.id]: n }} hasChildren={false} collapsed={false} selected={false} merged={false}
      editing={false} editValue="" onSelect={noop} onToggleCollapse={noop} onToggleMerge={noop}
      onDelete={noop} onUpdate={noop} onEdit={noop} onChange={noop} onCommit={noop} onCancel={noop}
    />,
  )
}

describe('BranchCard — người làm', () => {
  beforeEach(() => {
    useWorkflowStore.setState((state) => ({
      project: {
        ...state.project,
        members: [{ id: '9', name: 'a', roleTitle: 'OWNER', initials: 'A', avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0 }],
      },
    }))
  })

  afterEach(() => cleanup())

  it('assignee là id thành viên thì hiện tên, không hiện id', () => {
    renderCard(node('9'))

    expect(screen.getByTitle('Assignee: a')).toBeTruthy()
    expect(screen.queryByText('9')).toBeNull()
  })

  it('chưa giao thì hiện Unassigned', () => {
    renderCard(node(null))

    expect(screen.getByText('Unassigned')).toBeTruthy()
  })
})
