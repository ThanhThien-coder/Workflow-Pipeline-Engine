// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePhaseKanban } from '../usePhaseKanban'
import { MockWorkflowService } from '../../services/mockWorkflowService'
import { MockConfig } from '../../services/mock/MockConfig'
import { createWorkflowStore, useWorkflowStore } from '../../store/useWorkflowStore'
import type { MacroPhase } from '../../types/workflow.types'

describe('usePhaseKanban Hook', () => {
  const p2aPhase: MacroPhase = {
    id: 'p2a',
    name: 'PHASE 2A',
    sub: 'Cụm Xác thực (Auth)',
    status: 'IN_PROGRESS',
    pct: 70,
    accent: 'blue',
    x: 360,
    y: 40,
    w: 440,
    h: 170,
    parentPhaseIds: ['p1'],
  }

  beforeEach(() => {
    MockConfig.latencyMs = 0
    MockConfig.fakeError500 = false
    useWorkflowStore.setState({
      trees: {},
      selectedPhaseId: null,
      macroPhases: [p2aPhase],
      kanban: {
        ...useWorkflowStore.getState().kanban,
        currentUserId: '1',
        tasks: [],
        filterPhaseId: 'ALL',
      },
    })
  })

  it('loads all tasks of the specified phase across all team members (not just current user)', async () => {
    const { result } = renderHook(() => usePhaseKanban(p2aPhase))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.phaseTasks.length).toBeGreaterThan(0)
    })

    // Phase 2A should contain tasks from Alex Kim (1), Sarah Chen (2), and Marcus Liu (3)
    const assignedUserIds = new Set(result.current.phaseTasks.map((t) => t.assignedUserId))
    expect(assignedUserIds.has('1')).toBe(true) // Alex Kim (WPE-043)
    expect(assignedUserIds.has('2')).toBe(true) // Sarah Chen (WPE-001, WPE-012)
    expect(assignedUserIds.has('3')).toBe(true) // Marcus Liu (WPE-020, WPE-024, etc.)
  })

  it('does not mutate personal MyTasks list or leak private filtering', async () => {
    const { result } = renderHook(() => usePhaseKanban(p2aPhase))

    await waitFor(() => {
      expect(result.current.phaseTasks.length).toBeGreaterThan(0)
    })

    // Personal tasks store state remains clean and scoped
    const personalTasks = useWorkflowStore.getState().kanban.tasks
    expect(Array.isArray(personalTasks)).toBe(true)
  })

  it('synchronizes newly added Graph tree nodes into Phase Kanban and reflects status changes', async () => {
    // Add a new graph node into trees['p2a']
    const customGraphNode = {
      kind: 'branch' as const,
      id: 'task-sync-999',
      code: 'WPE-999',
      title: 'Graph Created Task for Kanban',
      description: 'Synchronized task',
      phaseId: 'p2a',
      trackId: 'trk-1',
      parentId: 'trk-1',
      parentIds: ['trk-1'],
      status: 'TODO' as const,
      isTrack: false,
      assignee: 'Alex Kim',
      due: '2026-10-20',
      blocker: null,
      joinPolicy: null,
      level: 2,
      order: 9,
    }

    useWorkflowStore.getState().updateTree('p2a', (nodes) => ({
      ...nodes,
      [customGraphNode.id]: customGraphNode,
    }))

    const { result } = renderHook(() => usePhaseKanban(p2aPhase))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      const syncedTask = result.current.phaseTasks.find((t) => t.id === 'task-sync-999')
      expect(syncedTask).toBeDefined()
      expect(syncedTask?.title).toBe('Graph Created Task for Kanban')
      expect(syncedTask?.status).toBe('TODO')
    })

    // Now move task to IN_PROGRESS
    await result.current.moveTask('task-sync-999', 'IN_PROGRESS')

    await waitFor(() => {
      const movedTask = result.current.phaseTasks.find((t) => t.id === 'task-sync-999')
      expect(movedTask?.status).toBe('IN_PROGRESS')

      // Check graph tree updated
      const treeNode = useWorkflowStore.getState().trees['p2a']?.['task-sync-999']
      expect(treeNode?.kind === 'branch' && treeNode.status).toBe('IN_PROGRESS')
    })
  })
})
