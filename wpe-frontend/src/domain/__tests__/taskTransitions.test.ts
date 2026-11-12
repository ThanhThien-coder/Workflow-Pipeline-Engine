import { describe, it, expect } from 'vitest'
import { evaluateTransition } from '../taskTransitions'

describe('Domain: evaluateTransition', () => {
  const owner = { id: 'user-owner', projectRole: 'OWNER' as const }
  const manager = { id: 'user-manager', projectRole: 'MANAGER' as const }
  const collaborator = { id: 'user-collab', projectRole: 'COLLABORATOR' as const }
  const otherMember = { id: 'user-other', projectRole: 'COLLABORATOR' as const }

  const taskOfCollab = {
    status: 'REVIEW' as const,
    assignedUserId: 'user-collab',
  }

  it('allows Owner to approve a task assigned to another team member (REVIEW -> DONE)', () => {
    const decision = evaluateTransition(taskOfCollab, 'DONE', owner)
    expect(decision.kind).toBe('allow')
  })

  it('allows Owner to reject a task assigned to another team member (REVIEW -> IN_PROGRESS)', () => {
    const decision = evaluateTransition(taskOfCollab, 'IN_PROGRESS', owner)
    expect(decision.kind).toBe('allow')
  })

  it('allows Manager to approve a task assigned to another team member (REVIEW -> DONE)', () => {
    const decision = evaluateTransition(taskOfCollab, 'DONE', manager)
    expect(decision.kind).toBe('allow')
  })

  it('allows Manager to reject a task assigned to another team member (REVIEW -> IN_PROGRESS)', () => {
    const decision = evaluateTransition(taskOfCollab, 'IN_PROGRESS', manager)
    expect(decision.kind).toBe('allow')
  })

  it('denies Manager from starting someone else task (TODO -> IN_PROGRESS)', () => {
    const todoTask = { status: 'TODO' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(todoTask, 'IN_PROGRESS', manager)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toBe('Bạn chỉ thao tác được trên task của mình.')
    }
  })

  it('denies Manager from approving a task not in REVIEW (IN_PROGRESS -> DONE)', () => {
    const inProgressTask = { status: 'IN_PROGRESS' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(inProgressTask, 'DONE', manager)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toBe('Task phải qua bước Chờ duyệt trước khi được nghiệm thu.')
    }
  })

  it('denies a non-owner from approving another member task', () => {
    const decision = evaluateTransition(taskOfCollab, 'DONE', otherMember)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toContain('Bạn chỉ thao tác được trên task của mình')
    }
  })

  it('denies a non-owner from approving even their own task (Strict Review Constraint)', () => {
    const decision = evaluateTransition(taskOfCollab, 'DONE', collaborator)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toContain('Chỉ Owner hoặc Quản lý mới có quyền duyệt')
    }
  })

  it('denies Owner from starting someone else task (TODO -> IN_PROGRESS)', () => {
    const todoTask = { status: 'TODO' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(todoTask, 'IN_PROGRESS', owner)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toContain('Bạn chỉ thao tác được trên task của mình')
    }
  })

  it('allows assignee to start their own task (TODO -> IN_PROGRESS)', () => {
    const todoTask = { status: 'TODO' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(todoTask, 'IN_PROGRESS', collaborator)
    expect(decision.kind).toBe('allow')
  })

  it('requires artifact submission when moving IN_PROGRESS -> REVIEW', () => {
    const inProgressTask = { status: 'IN_PROGRESS' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(inProgressTask, 'REVIEW', collaborator)
    expect(decision.kind).toBe('needs-artifact')
  })

  it('denies modification when task is already DONE', () => {
    const doneTask = { status: 'DONE' as const, assignedUserId: 'user-collab' }
    const decision = evaluateTransition(doneTask, 'IN_PROGRESS', owner)
    expect(decision.kind).toBe('deny')
    if (decision.kind === 'deny') {
      expect(decision.message).toContain('Task đã DONE')
    }
  })
})
