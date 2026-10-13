// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PhaseKanbanBoard } from '../PhaseKanbanBoard'
import type { KanbanTask, UserSummary } from '../../../types/kanban.types'

describe('PhaseKanbanBoard Component', () => {
  afterEach(() => {
    cleanup()
  })

  const mockMembers: UserSummary[] = [
    {
      id: '1',
      name: 'Alex Kim',
      roleTitle: 'Project Lead',
      initials: 'AK',
      avatarClass: 'bg-emerald-500',
      projectRole: 'OWNER',
      assignedTaskCount: 1,
    },
    {
      id: '2',
      name: 'Sarah Chen',
      roleTitle: 'Frontend Dev',
      initials: 'SC',
      avatarClass: 'bg-indigo-500',
      projectRole: 'COLLABORATOR',
      assignedTaskCount: 1,
    },
    {
      id: '3',
      name: 'Marcus Liu',
      roleTitle: 'Backend Dev',
      initials: 'ML',
      avatarClass: 'bg-rose-500',
      projectRole: 'COLLABORATOR',
      assignedTaskCount: 1,
    },
  ]

  const mockTasks: KanbanTask[] = [
    {
      id: 'task-1',
      code: 'WPE-001',
      title: 'UI Form Dang Nhap',
      description: 'Dung form Login/Register',
      status: 'TODO',
      assignedUserId: '2', // Sarah Chen
      phaseId: 'P2A',
      phaseLabel: 'Phase 2A · Auth',
      dueDate: '2026-10-06T00:00:00Z',
      isOverdue: false,
      joinPolicySummary: 'AND-Join',
      artifacts: [],
      version: 0,
    },
    {
      id: 'task-2',
      code: 'WPE-024',
      title: 'Dich vu cap phat JWT',
      description: 'Sinh va verify token',
      status: 'IN_PROGRESS',
      assignedUserId: '3', // Marcus Liu
      phaseId: 'P2A',
      phaseLabel: 'Phase 2A · Auth',
      dueDate: '2026-09-28T00:00:00Z',
      isOverdue: true,
      joinPolicySummary: 'None',
      artifacts: [],
      version: 0,
    },
    {
      id: 'task-3',
      code: 'WPE-043',
      title: 'API Gateway Configuration',
      description: 'Setup routing & rate limit',
      status: 'REVIEW',
      assignedUserId: '1', // Alex Kim
      phaseId: 'P2A',
      phaseLabel: 'Phase 2A · Auth',
      dueDate: '2026-10-04T00:00:00Z',
      isOverdue: false,
      joinPolicySummary: 'None',
      artifacts: [],
      version: 0,
    },
  ]

  it('renders all 4 standard Kanban columns', () => {
    render(
      <PhaseKanbanBoard
        phaseId="p2a"
        tasks={mockTasks}
        members={mockMembers}
        onOpenTaskDetails={vi.fn()}
      />
    )

    expect(screen.getByText('To Do')).toBeDefined()
    expect(screen.getByText('In Progress')).toBeDefined()
    expect(screen.getByText('In Review')).toBeDefined()
    expect(screen.getByText('Done')).toBeDefined()
  })

  it('displays accurate assignee initials and names for different team members in the same phase', () => {
    render(
      <PhaseKanbanBoard
        phaseId="p2a"
        tasks={mockTasks}
        members={mockMembers}
        onOpenTaskDetails={vi.fn()}
      />
    )

    // Sarah Chen (SC) on task 1
    expect(screen.getByText('SC')).toBeDefined()
    expect(screen.getByText('Sarah Chen')).toBeDefined()

    // Marcus Liu (ML) on task 2
    expect(screen.getByText('ML')).toBeDefined()
    expect(screen.getByText('Marcus Liu')).toBeDefined()

    // Alex Kim (AK) on task 3
    expect(screen.getByText('AK')).toBeDefined()
    expect(screen.getByText('Alex Kim')).toBeDefined()
  })

  it('calls onOpenTaskDetails when clicking card or Details button', () => {
    const handleOpenDetails = vi.fn()
    render(
      <PhaseKanbanBoard
        phaseId="p2a"
        tasks={mockTasks}
        members={mockMembers}
        onOpenTaskDetails={handleOpenDetails}
      />
    )

    const taskTitle = screen.getByText('UI Form Dang Nhap')
    fireEvent.click(taskTitle)
    expect(handleOpenDetails).toHaveBeenCalledWith(mockTasks[0])
  })
})
