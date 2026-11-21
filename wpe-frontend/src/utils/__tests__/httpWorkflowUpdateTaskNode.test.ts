import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dateInputToEndOfDayIso, isoToDateInput } from '../dueDate'

const graphMocks = vi.hoisted(() => ({
  fetchGraph: vi.fn(),
  updateNode: vi.fn(),
  toBackendId: vi.fn((id: string) => Number(id)),
}))

vi.mock('../../services/impl/http/graph', () => ({
  PHASE_POSITION_DEBOUNCE_MS: 300,
  createKeyedDebounce: () => (fn: () => Promise<void>) => fn(),
  fetchGraph: (...args: unknown[]) => graphMocks.fetchGraph(...args),
  updateNode: (...args: unknown[]) => graphMocks.updateNode(...args),
  toBackendId: (id: string) => graphMocks.toBackendId(id),
}))

import { HttpWorkflowService } from '../../services/impl/HttpWorkflowService'

describe('HttpWorkflowService.updateTaskNode — chỉ gửi dueDate / clearDueDate khi hạn thay đổi', () => {
  beforeEach(() => {
    graphMocks.fetchGraph.mockReset()
    graphMocks.updateNode.mockReset()
  })

  it('không đổi hạn (kể cả task có dueDate hay dueDate null) thì bỏ cả dueDate và clearDueDate khỏi body', async () => {
    const savedDueIso = '2026-11-20T16:59:59.000Z'
    const savedDayInput = isoToDateInput(savedDueIso)

    graphMocks.fetchGraph.mockResolvedValue({
      phases: [{ id: 10, name: 'P1', orderIndex: 0 }],
      phaseEdges: [],
      nodes: [
        {
          id: 101,
          phaseId: 10,
          code: 'T-1',
          title: 'Overdue task',
          status: 'TODO',
          joinPolicy: 'ALL_COMPLETED',
          version: 3,
          dueDate: savedDueIso,
        },
        {
          id: 102,
          phaseId: 10,
          code: 'T-2',
          title: 'Done without due',
          status: 'DONE',
          joinPolicy: 'ALL_COMPLETED',
          version: 5,
          dueDate: null,
        },
      ],
      dependencies: [],
    })
    graphMocks.updateNode.mockImplementation(async (id: number, body: Record<string, unknown>) => ({
      id,
      phaseId: 10,
      code: id === 101 ? 'T-1' : 'T-2',
      title: String(body.title),
      status: id === 101 ? 'TODO' : 'DONE',
      version: Number(body.version) + 1,
      dueDate: id === 101 ? savedDueIso : null,
    }))

    const service = new HttpWorkflowService()
    await service.getMacroPhases('1')

    await service.updateTaskNode('101', {
      title: 'Renamed overdue task',
      description: 'desc',
      joinPolicy: 'ALL_COMPLETED',
      assigneeId: null,
      dueDate: savedDayInput,
    })

    const firstBody = graphMocks.updateNode.mock.calls[0][1]
    expect(firstBody.title).toBe('Renamed overdue task')
    expect('dueDate' in firstBody).toBe(false)
    expect('clearDueDate' in firstBody).toBe(false)

    await service.updateTaskNode('102', {
      title: 'Renamed done task',
      description: '',
      joinPolicy: 'ALL_COMPLETED',
      assigneeId: null,
      dueDate: null,
    })

    const secondBody = graphMocks.updateNode.mock.calls[1][1]
    expect(secondBody.title).toBe('Renamed done task')
    expect('dueDate' in secondBody).toBe(false)
    expect('clearDueDate' in secondBody).toBe(false)
  })

  it('đổi hạn hoặc xóa hạn thì gửi đúng dueDate hoặc clearDueDate', async () => {
    const savedDueIso = '2026-11-20T16:59:59.000Z'

    graphMocks.fetchGraph.mockResolvedValue({
      phases: [{ id: 10, name: 'P1', orderIndex: 0 }],
      phaseEdges: [],
      nodes: [
        {
          id: 201,
          phaseId: 10,
          code: 'T-3',
          title: 'Editable due',
          status: 'TODO',
          joinPolicy: 'ALL_COMPLETED',
          version: 1,
          dueDate: savedDueIso,
        },
      ],
      dependencies: [],
    })
    graphMocks.updateNode.mockResolvedValue({
      id: 201,
      phaseId: 10,
      code: 'T-3',
      title: 'Editable due',
      status: 'TODO',
      version: 2,
      dueDate: dateInputToEndOfDayIso('2026-11-25'),
    })

    const service = new HttpWorkflowService()
    await service.getMacroPhases('1')

    await service.updateTaskNode('201', {
      title: 'Editable due',
      description: '',
      joinPolicy: 'ALL_COMPLETED',
      assigneeId: null,
      dueDate: '2026-11-25',
    })
    expect(graphMocks.updateNode.mock.calls[0][1]).toMatchObject({
      dueDate: dateInputToEndOfDayIso('2026-11-25'),
    })
    expect('clearDueDate' in graphMocks.updateNode.mock.calls[0][1]).toBe(false)

    await service.updateTaskNode('201', {
      title: 'Editable due',
      description: '',
      joinPolicy: 'ALL_COMPLETED',
      assigneeId: null,
      dueDate: null,
    })
    expect(graphMocks.updateNode.mock.calls[1][1]).toMatchObject({
      clearDueDate: true,
    })
    expect('dueDate' in graphMocks.updateNode.mock.calls[1][1]).toBe(false)
  })
})
