// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { WorkflowService } from '../../../services/workflow/WorkflowService'
import { WorkflowServiceProvider } from '../../../services/workflow/WorkflowContext'
import { MicroGraphTree } from '../MicroGraphTree'
import { AddGhostModal } from '../AddGhostModal'
import { AddRootTaskModal } from '../AddRootTaskModal'
import { GhostCard } from '../GhostCard'
import { calculatePhaseGraphLayout } from '../../../utils/spanningTreeLayout'
import { useWorkflowStore } from '../../../store/useWorkflowStore'
import type { GraphNodeMap, BranchGraphNode, GhostGraphNode } from '../../../types/workflow.types'

describe('Phase Detail Tree Graph & Ghost Node Placement (WPE)', () => {
  let service: WorkflowService

  beforeEach(async () => {
    service = new WorkflowService()
    await useWorkflowStore.getState().resetPhaseTree('p2a')
  })

  afterEach(() => {
    cleanup()
  })

  describe('Clean Architecture & Dependency Injection (WorkflowService)', () => {
    it('fetches phase graph conforming to IWorkflowService contract', async () => {
      const graph = await service.getPhaseGraph('p2a')

      expect(graph.root).toBeDefined()
      expect(graph.root.id).toBe('root')
      expect(Array.isArray(graph.nodes)).toBe(true)
      expect(graph.nodes.length).toBeGreaterThan(0)
      expect(Array.isArray(graph.ghostDependencies)).toBe(true)

      // Verify domain model fields
      const firstNode = graph.nodes[0]
      expect(firstNode.id).toBeDefined()
      expect(firstNode.title).toBeDefined()
      expect(['LOCKED', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).toContain(firstNode.status)
    })

    it('adds a root track task using addRootTask', async () => {
      const newRoot = await service.addRootTask('p2a', { title: 'Track 5: Performance Testing' })

      expect(newRoot.id).toMatch(/^trk-/)
      expect(newRoot.title).toBe('Track 5: Performance Testing')
      expect(newRoot.status).toBe('TODO')
      expect(newRoot.parentId).toBe('root')

      // Verify state store was updated
      const updatedTree = useWorkflowStore.getState().trees['p2a']
      expect(updatedTree[newRoot.id]).toBeDefined()
      expect((updatedTree[newRoot.id] as BranchGraphNode).isTrack).toBe(true)
    })

    it('attaches ghost prerequisite to target task and guards with LOCKED status if source is not DONE', async () => {
      // Phase 2B has task x1 which is 'TODO' (not DONE)
      const ghostDep = await service.attachGhostNode('p2a', {
        sourcePhaseId: 'p2b',
        sourceTaskId: 'x1',
        targetTaskId: 't_login',
      })

      expect(ghostDep.sourcePhaseId).toBe('p2b')
      expect(ghostDep.sourceTaskId).toBe('x1')
      expect(ghostDep.targetTaskId).toBe('t_login')
      expect(ghostDep.status).toBe('LOCKED')

      // Target task t_login in p2a should now be locked by this ghost
      const tree = useWorkflowStore.getState().trees['p2a']
      const targetTask = tree['t_login'] as BranchGraphNode
      expect(targetTask.status).toBe('LOCKED')
      expect(targetTask.parentIds).toContain(ghostDep.id)
    })
  })

  describe('Ghost Node Placement Logic (Strict Right-Side Anchoring)', () => {
    it('places ghost nodes strictly to the RIGHT of their target tasks', () => {
      const currentNodes = useWorkflowStore.getState().trees['p2a']
      const { layoutNodes, layoutEdges } = calculatePhaseGraphLayout(currentNodes)

      const ghostLayoutNodes = layoutNodes.filter((n) => n.type === 'ghost')
      expect(ghostLayoutNodes.length).toBeGreaterThan(0)

      ghostLayoutNodes.forEach((ghost) => {
        // Find ghost edge
        const ghostEdge = layoutEdges.find((e) => e.targetId === ghost.id && e.isGhost)
        expect(ghostEdge).toBeDefined()

        const targetPos = layoutNodes.find((n) => n.id === ghostEdge!.sourceId)
        expect(targetPos).toBeDefined()

        // Strict right-side invariant: ghost.x must be strictly greater than target.right
        expect(ghost.x).toBeGreaterThan(targetPos!.right)
        expect(ghost.left).toBe(targetPos!.right + 60)

        // Connecting curve must match specification:
        // M (targetX) (targetY) C (targetX + 50) (targetY), (ghostX - 50) (ghostY), (ghostX) (ghostY)
        const expectedD = `M ${targetPos!.right} ${targetPos!.centerY} C ${targetPos!.right + 50} ${targetPos!.centerY}, ${ghost.left - 50} ${ghost.centerY}, ${ghost.left} ${ghost.centerY}`
        expect(ghostEdge!.d).toBe(expectedD)
      })
    })

    it('discards unanchored or floating ghost nodes from layout', () => {
      const nodesWithFloatingGhost: GraphNodeMap = {
        ...useWorkflowStore.getState().trees['p2a'],
        'ghost-loose': {
          id: 'ghost-loose',
          kind: 'ghost',
          title: 'Unanchored Floating Ghost',
          parentIds: ['unknown-task-id'],
          refPhase: 'p3',
          refId: 'x1',
          dir: 'up',
        } as GhostGraphNode,
      }

      const { layoutNodes } = calculatePhaseGraphLayout(nodesWithFloatingGhost)
      const found = layoutNodes.find((n) => n.id === 'ghost-loose')
      expect(found).toBeUndefined() // Successfully eliminated floating loose ghost!
    })
  })

  describe('GhostCard Component Styling & Visuals', () => {
    it('renders Mixpanel deep purple styling, monospace badge, and Completed pill when DONE', () => {
      const doneGhost: GhostGraphNode = {
        id: 'ghost-test-done',
        kind: 'ghost',
        title: 'Core DB Schema',
        parentIds: ['t_db'],
        refPhase: 'p1',
        refId: 'x1',
        dir: 'up',
        status: 'DONE',
      }

      const handleDelete = vi.fn()
      const { container } = render(
        <GhostCard
          node={doneGhost}
          onSpawnDown={vi.fn()}
          onDelete={handleDelete}
        />
      )

      expect(screen.getByText('[GHOST - P1]')).toBeDefined()
      expect(screen.getByText('Completed ✓')).toBeDefined()
      expect(container.querySelector('.border-dashed')).toBeDefined()

      // CRITICAL RULE: Circular (+) button must be 100% eliminated
      expect(screen.queryByTitle(/connect dependency/i)).toBeNull()
      expect(container.querySelector('.cursor-grab')).toBeNull()

      // High-contrast typography checks
      const titleEl = screen.getByText('Core DB Schema')
      expect(titleEl.className).toContain('text-mp-ink')
      expect(titleEl.className).toContain('font-semibold')

      // Refined delete button exists and calls onDelete
      const deleteBtn = screen.getByTitle('Remove ghost prerequisite')
      expect(deleteBtn).toBeDefined()
      fireEvent.click(deleteBtn)
      expect(handleDelete).toHaveBeenCalledTimes(1)
    })

    it('renders Waiting Prerequisite pill when source task is not DONE', () => {
      const pendingGhost: GhostGraphNode = {
        id: 'ghost-test-pending',
        kind: 'ghost',
        title: 'Cart Schema Draft',
        parentIds: ['t_login'],
        refPhase: 'p2b',
        refId: 'x1',
        dir: 'up',
        status: 'LOCKED',
      }

      const { container } = render(
        <GhostCard
          node={pendingGhost}
          onSpawnDown={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByText('[GHOST - P2B]')).toBeDefined()
      expect(screen.getByText('Waiting Prerequisite ⏳')).toBeDefined()
      expect(screen.queryByTitle(/connect dependency/i)).toBeNull()
      expect(container.querySelector('button[title="Remove ghost prerequisite"]')).toBeDefined()
    })
  })

  describe('Bottom Toolbar & Redesigned Modals (100% English)', () => {
    it('renders 100% English bottom toolbar buttons (+ Add Root Task and Add Ghost Node)', () => {
      render(
        <WorkflowServiceProvider>
          <MicroGraphTree phaseId="p2a" />
        </WorkflowServiceProvider>
      )

      expect(screen.getByText('+ Add Root Task')).toBeDefined()
      expect(screen.getByText('Add Ghost Node')).toBeDefined()
    })

    it('opens 3-step cascading AddGhostModal with English labels when clicking Add Ghost Node', async () => {
      render(
        <WorkflowServiceProvider>
          <MicroGraphTree phaseId="p2a" />
        </WorkflowServiceProvider>
      )

      const addGhostBtn = screen.getByText('Add Ghost Node')
      fireEvent.click(addGhostBtn)

      // Modal header
      expect(screen.getByText('Attach Ghost Prerequisite')).toBeDefined()
      expect(
        screen.getByText(
          'Link an external milestone from another phase that blocks a task in this phase.'
        )
      ).toBeDefined()

      // 3 cascading fields
      expect(screen.getByLabelText('Source Phase')).toBeDefined()
      expect(screen.getByLabelText('Source Milestone / Task')).toBeDefined()
      expect(screen.getByLabelText('Target Task (Blocked by Prerequisite)')).toBeDefined()

      // Primary submit action
      expect(screen.getByText('Attach Ghost Node')).toBeDefined()
    })

    it('opens AddRootTaskModal when clicking + Add Root Task', () => {
      render(
        <WorkflowServiceProvider>
          <MicroGraphTree phaseId="p2a" />
        </WorkflowServiceProvider>
      )

      const addRootBtn = screen.getByText('+ Add Root Task')
      fireEvent.click(addRootBtn)

      expect(screen.getByText('Add Root Task')).toBeDefined()
      expect(screen.getByLabelText('Task / Milestone Title')).toBeDefined()
      expect(screen.getByText('Create Task')).toBeDefined()
    })
  })
})
