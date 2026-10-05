import { describe, it, expect } from 'vitest'
import { isTaskInPhase } from '../phaseTaskMatcher'
import type { KanbanTask } from '../../types/kanban.types'

describe('phaseTaskMatcher', () => {
  const baseTask: KanbanTask = {
    id: 't-1',
    code: 'WPE-001',
    title: 'Test Task',
    description: 'Testing',
    status: 'TODO',
    assignedUserId: '2',
    phaseId: 'P2A',
    phaseLabel: 'Phase 2A · Auth',
    dueDate: '2026-10-10T00:00:00Z',
    isOverdue: false,
    joinPolicySummary: 'None',
    artifacts: [],
    version: 0,
  }

  it('matches exact case-insensitive phase IDs', () => {
    expect(isTaskInPhase(baseTask, { id: 'p2a', name: 'PHASE 2A' })).toBe(true)
    expect(isTaskInPhase(baseTask, { id: 'P2A', name: 'PHASE 2A' })).toBe(true)
    expect(isTaskInPhase(baseTask, { id: 'P1', name: 'PHASE 1' })).toBe(false)
  })

  it('matches phase by normalized name', () => {
    expect(isTaskInPhase(baseTask, { id: 'custom-id', name: 'PHASE 2A' })).toBe(true)
  })

  it('returns false for null or undefined inputs', () => {
    expect(isTaskInPhase(baseTask, null)).toBe(false)
    expect(isTaskInPhase(null as unknown as KanbanTask, { id: 'p2a' })).toBe(false)
  })

  it('handles all standard phases accurately', () => {
    const p1Task: KanbanTask = { ...baseTask, phaseId: 'P1' }
    const p2bTask: KanbanTask = { ...baseTask, phaseId: 'P2B' }
    const p3Task: KanbanTask = { ...baseTask, phaseId: 'P3' }

    expect(isTaskInPhase(p1Task, { id: 'p1', name: 'PHASE 1' })).toBe(true)
    expect(isTaskInPhase(p2bTask, { id: 'p2b', name: 'PHASE 2B' })).toBe(true)
    expect(isTaskInPhase(p3Task, { id: 'p3', name: 'PHASE 3' })).toBe(true)

    expect(isTaskInPhase(p1Task, { id: 'p2a' })).toBe(false)
    expect(isTaskInPhase(p2bTask, { id: 'p3' })).toBe(false)
  })
})
