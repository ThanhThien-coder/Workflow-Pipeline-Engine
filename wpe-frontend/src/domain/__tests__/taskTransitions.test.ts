import { describe, it, expect } from 'vitest'
import { evaluateTransition } from '../taskTransitions'
import type { TaskStatus } from '../../types/kanban.types'

/** Luật theo backend StateMachineService.updateStatus. */
describe('Domain: evaluateTransition', () => {
  const owner = { id: 'user-owner', projectRole: 'OWNER' as const }
  const manager = { id: 'user-manager', projectRole: 'MANAGER' as const }
  const collaborator = { id: 'user-collab', projectRole: 'COLLABORATOR' as const }
  const viewer = { id: 'user-viewer', projectRole: 'VIEWER' as const }
  const other = { id: 'user-other', projectRole: 'COLLABORATOR' as const }

  const task = (status: TaskStatus, assignedUserId = 'user-collab') => ({ status, assignedUserId })

  describe('trạng thái dự án: Cộng tác viên chỉ làm task khi ACTIVE; Owner và Manager luôn làm', () => {
    it.each(['DRAFT', 'PLANNING', 'PAUSED', 'COMPLETED'])('dự án %s: Cộng tác viên bắt đầu task của mình -> deny kèm câu báo', (status) => {
      const decision = evaluateTransition(task('TODO'), 'IN_PROGRESS', collaborator, status)
      expect(decision.kind).toBe('deny')
      expect(decision.kind === 'deny' && decision.message).toMatch(/Only the owner or a manager can work on tasks until it is active/)
    })
    it('dự án DRAFT: Manager bắt đầu task được giao -> allow', () => {
      expect(evaluateTransition(task('TODO', 'user-manager'), 'IN_PROGRESS', manager, 'DRAFT').kind).toBe('allow')
    })
    it('dự án PAUSED: Owner duyệt task -> allow', () => {
      expect(evaluateTransition(task('REVIEW'), 'DONE', owner, 'PAUSED').kind).toBe('allow')
    })
    it('dự án ACTIVE hoặc chưa biết trạng thái: Cộng tác viên làm task của mình như cũ', () => {
      expect(evaluateTransition(task('TODO'), 'IN_PROGRESS', collaborator, 'ACTIVE').kind).toBe('allow')
      expect(evaluateTransition(task('TODO'), 'IN_PROGRESS', collaborator).kind).toBe('allow')
    })
  })

  describe('duyệt / trả lại (REVIEW): Owner hoặc Manager, task của bất kỳ ai', () => {
    it.each([['owner', owner], ['manager', manager]])('%s duyệt REVIEW -> DONE: allow', (_n, actor) => {
      expect(evaluateTransition(task('REVIEW'), 'DONE', actor).kind).toBe('allow')
    })
    it.each([['owner', owner], ['manager', manager]])('%s trả REVIEW -> IN_PROGRESS: allow', (_n, actor) => {
      expect(evaluateTransition(task('REVIEW'), 'IN_PROGRESS', actor).kind).toBe('allow')
    })
    it.each([['collaborator', collaborator], ['viewer', viewer], ['người khác', other]])('%s không duyệt được', (_n, actor) => {
      const approve = evaluateTransition(task('REVIEW'), 'DONE', actor)
      expect(approve.kind).toBe('deny')
      if (approve.kind === 'deny') expect(approve.message).toContain('Only the project owner or a manager can approve')
      expect(evaluateTransition(task('REVIEW'), 'IN_PROGRESS', actor).kind).toBe('deny')
    })
    it('chỉ duyệt được task đang ở REVIEW', () => {
      const d = evaluateTransition(task('IN_PROGRESS'), 'DONE', manager)
      expect(d.kind).toBe('deny')
      if (d.kind === 'deny') expect(d.message).toBe('A task must go through Review before it can be accepted.')
      expect(evaluateTransition(task('TODO'), 'DONE', owner).kind).toBe('deny')
    })
  })

  describe('bắt đầu / bỏ nhận / nộp: người được giao hoặc Owner', () => {
    it('Owner bắt đầu task của người khác: allow', () => {
      expect(evaluateTransition(task('TODO'), 'IN_PROGRESS', owner).kind).toBe('allow')
    })
    it('Owner bắt đầu task chưa giao: allow', () => {
      expect(evaluateTransition(task('TODO', ''), 'IN_PROGRESS', owner).kind).toBe('allow')
    })
    it('Manager bắt đầu task của người khác: deny', () => {
      const d = evaluateTransition(task('TODO'), 'IN_PROGRESS', manager)
      expect(d.kind).toBe('deny')
      if (d.kind === 'deny') expect(d.message).toContain('You can only update your own tasks')
    })
    it('Manager bắt đầu task của chính mình: allow', () => {
      expect(evaluateTransition(task('TODO', 'user-manager'), 'IN_PROGRESS', manager).kind).toBe('allow')
    })
    it('Collaborator task của mình: bắt đầu allow, bỏ nhận allow, nộp cần minh chứng', () => {
      expect(evaluateTransition(task('TODO'), 'IN_PROGRESS', collaborator).kind).toBe('allow')
      expect(evaluateTransition(task('IN_PROGRESS'), 'TODO', collaborator).kind).toBe('allow')
      expect(evaluateTransition(task('IN_PROGRESS'), 'REVIEW', collaborator).kind).toBe('needs-artifact')
    })
    it('Collaborator / Viewer không đụng được task của người khác hay task chưa giao', () => {
      expect(evaluateTransition(task('TODO'), 'IN_PROGRESS', other).kind).toBe('deny')
      expect(evaluateTransition(task('TODO', ''), 'IN_PROGRESS', collaborator).kind).toBe('deny')
      expect(evaluateTransition(task('IN_PROGRESS'), 'REVIEW', viewer).kind).toBe('deny')
      expect(evaluateTransition(task('IN_PROGRESS'), 'TODO', other).kind).toBe('deny')
    })
    it('Owner nộp / bỏ nhận task của người khác', () => {
      expect(evaluateTransition(task('IN_PROGRESS'), 'REVIEW', owner).kind).toBe('needs-artifact')
      expect(evaluateTransition(task('IN_PROGRESS'), 'TODO', owner).kind).toBe('allow')
    })
  })

  describe('các bước không có trong backend', () => {
    it('TODO -> REVIEW và REVIEW -> TODO bị từ chối kể cả Owner', () => {
      expect(evaluateTransition(task('TODO'), 'REVIEW', owner).kind).toBe('deny')
      expect(evaluateTransition(task('REVIEW'), 'TODO', owner).kind).toBe('deny')
    })
    it('LOCKED không chuyển được (kể cả Owner), cũng không chuyển về LOCKED', () => {
      expect(evaluateTransition(task('LOCKED', 'user-owner'), 'IN_PROGRESS', owner).kind).toBe('deny')
      expect(evaluateTransition(task('LOCKED', 'user-owner'), 'TODO', owner).kind).toBe('deny')
      expect(evaluateTransition(task('TODO', 'user-owner'), 'LOCKED', owner).kind).toBe('deny')
    })
    it('DONE khóa hẳn', () => {
      const d = evaluateTransition(task('DONE'), 'IN_PROGRESS', owner)
      expect(d.kind).toBe('deny')
      if (d.kind === 'deny') expect(d.message).toContain('This task is Done')
    })
    it('thả về đúng cột cũ: deny không có thông báo', () => {
      expect(evaluateTransition(task('TODO'), 'TODO', owner)).toEqual({ kind: 'deny', message: '' })
    })
  })
})
