import { describe, expect, it } from 'vitest'
import { buildGuestReport, daysBetween, detectArtifactKind, vnDay } from '../guestReport'
import type { GuestReportDto } from '../../types/guest.types'

import overviewNew from '../__fixtures__/guest-overview-new.json'
import expectedNew from '../__fixtures__/guest-expected-new.json'
import overviewNormal from '../__fixtures__/guest-overview-normal.json'
import expectedNormal from '../__fixtures__/guest-expected-normal.json'
import overviewDone from '../__fixtures__/guest-overview-done.json'
import expectedDone from '../__fixtures__/guest-expected-done.json'
import overviewLarge from '../__fixtures__/guest-overview-large.json'
import expectedLarge from '../__fixtures__/guest-expected-large.json'

interface ExpectedFixture {
  total: number
  done: number
  pct: number
  overdueCodes: string[]
  blockedByOverdue: number
  onTime: number
  onTimeBase: number
  breakdown: Record<string, number>
  lateDone: Array<{ code: string; lateBy: number }>
  lateDays: number
  overdueDays: number
  missed: number
  reopened: number
  completed: boolean
  lastDueDate: string | null
  finishedAt: string | null
  currentPhase: string | null
  attention: Array<{ code: string; kind: number; text: string }>
  phases: Array<{
    name: string
    index: number
    tasks: number
    done: number
    pct: number
    overdue: number
    late: number
    plannedEnd: string | null
    start: string | null
    end: string | null
    verdict: string
    onTimePct: number | null
  }>
  team: Array<{
    memberId: string
    total: number
    done: number
    onTime: number
    late: number
    worstCode: string | null
    worstDays: number
    overdue: number
    active: number
    todo: number
    waiting: number
    onTimePct: number | null
  }>
  blocks: Record<string, string[]>
}

function assertMatchesExpected(reportDto: GuestReportDto, expected: ExpectedFixture) {
  const model = buildGuestReport(reportDto)
  const { metrics } = model

  expect(metrics.total).toBe(expected.total)
  expect(metrics.done).toBe(expected.done)
  expect(metrics.pct).toBe(expected.pct)
  expect(metrics.overdue.map((t) => t.code)).toEqual(expected.overdueCodes)
  expect(metrics.blockedByOverdue).toBe(expected.blockedByOverdue)
  expect(metrics.onTime).toBe(expected.onTime)
  expect(metrics.onTimeBase).toBe(expected.onTimeBase)
  expect(metrics.breakdown).toEqual(expected.breakdown)
  expect(metrics.lateDone.map((x) => ({ code: x.task.code, lateBy: x.lateBy }))).toEqual(expected.lateDone)
  expect(metrics.lateDays).toBe(expected.lateDays)
  expect(metrics.overdueDays).toBe(expected.overdueDays)
  expect(metrics.missed).toBe(expected.missed)
  expect(metrics.reopened).toBe(expected.reopened)
  expect(metrics.completed).toBe(expected.completed)
  expect(metrics.lastDueDate?.toISOString() ?? null).toBe(expected.lastDueDate)
  expect(metrics.finishedAt?.toISOString() ?? null).toBe(expected.finishedAt)
  expect(metrics.currentPhase?.name ?? null).toBe(expected.currentPhase)
  expect(metrics.attention.map((a) => ({ code: a.task.code, kind: a.kind, text: a.text }))).toEqual(expected.attention)

  expect(
    model.phases.map((p) => ({
      name: p.name,
      index: p.index,
      tasks: p.tasks.length,
      done: p.done,
      pct: p.pct,
      overdue: p.overdue,
      late: p.late,
      plannedEnd: p.plannedEnd?.toISOString() ?? null,
      start: p.start?.toISOString() ?? null,
      end: p.end?.toISOString() ?? null,
      verdict: p.verdict.label,
      onTimePct: p.onTimePct,
    })),
  ).toEqual(expected.phases)

  const actualTeamById = Object.fromEntries(
    model.team.rows.map((r) => [
      r.memberId,
      {
        memberId: r.memberId,
        total: r.total,
        done: r.done,
        onTime: r.onTime,
        late: r.late,
        worstCode: r.worst?.task.code ?? null,
        worstDays: r.worst?.lateBy ?? 0,
        overdue: r.overdue,
        active: r.active,
        todo: r.todo,
        waiting: r.waiting,
        onTimePct: r.onTimePct,
      },
    ]),
  )
  expect(model.team.rows).toHaveLength(expected.team.length)
  for (const expRow of expected.team) {
    expect(actualTeamById[expRow.memberId]).toEqual(expRow)
  }

  const actualBlocks: Record<string, string[]> = {}
  for (const t of model.tasks) {
    if (t.blocks.length > 0) {
      actualBlocks[t.code] = t.blocks.map((id) => model.byId[id].code).sort()
    }
  }
  const normalizedExpectedBlocks: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(expected.blocks)) {
    normalizedExpectedBlocks[k] = [...v].sort()
  }
  expect(actualBlocks).toEqual(normalizedExpectedBlocks)

  return model
}

function makeBaseDto(overrides: Partial<GuestReportDto> = {}): GuestReportDto {
  return {
    serverNow: '2026-11-20T08:00:00.000Z', // 15:00+07:00
    project: {
      name: 'Demo',
      description: '',
      status: 'ACTIVE',
      createdAt: '2026-11-01T05:00:00.000Z',
      linkExpiresAt: null,
    },
    graph: {
      phases: [
        {
          id: 'p1',
          name: 'Phase 1',
          orderIndex: 0,
          parentPhaseIds: [],
        },
      ],
      phaseEdges: [],
      nodes: [],
      dependencies: [],
    },
    members: [{ id: 'u1', name: 'An Nguyễn', role: 'OWNER' }],
    artifacts: [],
    feedback: { total: 0, resolved: 0 },
    ...overrides,
  }
}

describe('vnDay & daysBetween (UTC+7 cố định)', () => {
  it('tính đúng ranh giới ngày theo giờ Việt Nam (UTC+7)', () => {
    // 2026-11-20T16:59:59.000Z = 2026-11-20 23:59:59+07:00 (vẫn ngày 20)
    // 2026-11-20T17:00:00.000Z = 2026-11-21 00:00:00+07:00 (sang ngày 21)
    const beforeMidnight = '2026-11-20T16:59:59.000Z'
    const afterMidnight = '2026-11-20T17:00:00.000Z'

    expect(vnDay(beforeMidnight).toISOString()).toBe('2026-11-19T17:00:00.000Z')
    expect(vnDay(afterMidnight).toISOString()).toBe('2026-11-20T17:00:00.000Z')
    expect(daysBetween(beforeMidnight, afterMidnight)).toBe(1)
  })
})

describe('buildGuestReport đối chiếu 4 bộ dữ liệu mẫu', () => {
  it('bộ new khớp toàn bộ trường expected', () => {
    const model = assertMatchesExpected(overviewNew.report as GuestReportDto, expectedNew as ExpectedFixture)
    expect(model.burnUp.unit).toBe('day')
    expect(model.burnUp.buckets.length).toBeGreaterThan(0)
  })

  it('bộ normal khớp toàn bộ trường expected', () => {
    const model = assertMatchesExpected(overviewNormal.report as GuestReportDto, expectedNormal as ExpectedFixture)
    expect(model.burnUp.unit).toBe('week')
    expect(model.team.unassignedTasks.map((t) => t.code)).toEqual(['WPE-15'])
    expect(model.artifacts.length).toBe(9)
    expect(model.artifacts[0].host).toBeTruthy()
    expect(model.artifacts[0].taskCode).toBeTruthy()
  })

  it('bộ done khớp toàn bộ trường expected', () => {
    const model = assertMatchesExpected(overviewDone.report as GuestReportDto, expectedDone as ExpectedFixture)
    expect(model.burnUp.unit).toBe('week')
    expect(model.metrics.completed).toBe(true)
  })

  it('bộ large khớp toàn bộ trường expected', () => {
    const model = assertMatchesExpected(overviewLarge.report as GuestReportDto, expectedLarge as ExpectedFixture)
    expect(model.burnUp.unit).toBe('month')
    expect(model.phases.find((p) => p.index === -1)?.id).toBe('none')
  })
})

describe('buildGuestReport: 5 trường hợp thiếu dữ liệu', () => {
  it('1. dueDate null: không quá hạn/trễ, không tính vào plannedEnd, onTime hay onTimeBase', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'No due done',
            status: 'DONE',
            assignedUserId: 'u1',
            dueDate: null,
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: '2026-11-18T05:00:00.000Z',
            startedAt: '2026-11-02T05:00:00.000Z',
          },
          {
            id: '2',
            phaseId: 'p1',
            code: 'T-2',
            title: 'No due open',
            status: 'IN_PROGRESS',
            assignedUserId: 'u1',
            dueDate: null,
            createdAt: '2026-11-01T05:00:00.000Z',
            startedAt: '2026-11-10T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.metrics.overdue).toHaveLength(0)
    expect(model.metrics.lateDone).toHaveLength(0)
    expect(model.metrics.onTime).toBe(0)
    expect(model.metrics.onTimeBase).toBe(0)
    expect(model.metrics.lastDueDate).toBeNull()
    expect(model.phases[0].plannedEnd).toBeNull()
    expect(model.phases[0].onTimePct).toBeNull()
    expect(model.team.rows[0].onTimePct).toBeNull()
  })

  it('2. task DONE mà completedAt null: không tính trễ, không tính vào finishedAt', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Done without completedAt',
            status: 'DONE',
            assignedUserId: 'u1',
            dueDate: '2026-11-05T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: null,
            startedAt: null,
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.metrics.done).toBe(1)
    expect(model.metrics.lateDone).toHaveLength(0)
    expect(model.metrics.finishedAt).toBeNull()
    expect(model.phases[0].end).toBeNull()
    expect(model.phases[0].late).toBe(0)
  })

  it('3. startedAt null: dùng completedAt làm fallback cho start của phase', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Done missing startedAt',
            status: 'DONE',
            assignedUserId: 'u1',
            dueDate: '2026-11-25T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: '2026-11-10T05:00:00.000Z',
            startedAt: null,
          },
          {
            id: '2',
            phaseId: 'p1',
            code: 'T-2',
            title: 'Open',
            status: 'TODO',
            assignedUserId: 'u1',
            dueDate: '2026-11-26T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.phases[0].start?.toISOString()).toBe('2026-11-10T05:00:00.000Z')
    expect(model.phases[0].verdict.label).toBe('On track')
  })

  it('4. phase có IN_PROGRESS hoặc REVIEW nhưng không có startedAt: không bao giờ ra Not started', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [
          { id: 'p1', name: 'P1', orderIndex: 0 },
          { id: 'p2', name: 'P2', orderIndex: 1 },
        ],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'In progress no start',
            status: 'IN_PROGRESS',
            dueDate: '2026-11-25T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            startedAt: null,
          },
          {
            id: '2',
            phaseId: 'p2',
            code: 'T-2',
            title: 'Review no start',
            status: 'REVIEW',
            dueDate: '2026-11-25T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            startedAt: null,
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.phases[0].verdict.label).toBe('On track')
    expect(model.phases[1].verdict.label).toBe('On track')
  })

  it('5. phase không có task: verdict là No tasks', () => {
    const dto = makeBaseDto()
    const model = buildGuestReport(dto)
    expect(model.phases[0].status).toBe('NO_TASKS')
    expect(model.phases[0].verdict).toEqual({ label: 'No tasks', tone: 'slate' })
  })
})

describe('detectArtifactKind & bảo mật URL artifact', () => {
  it('nhận diện đúng tất cả các loại artifact theo luật backend', () => {
    expect(detectArtifactKind('https://www.figma.com/file/abc')).toBe('FIGMA')
    expect(detectArtifactKind('https://github.com/org/repo/pull/1')).toBe('PR')
    expect(detectArtifactKind('https://gitlab.com/org/repo/-/merge_requests/2')).toBe('PR')
    expect(detectArtifactKind('https://api.example.com/swagger-ui.html')).toBe('SWAGGER')
    expect(detectArtifactKind('https://api.example.com/openapi.json')).toBe('SWAGGER')
    expect(detectArtifactKind('https://api.example.com/v3/api-docs')).toBe('SWAGGER')
    expect(detectArtifactKind('https://docs.google.com/document/d/123')).toBe('DOCS')
    expect(detectArtifactKind('https://drive.google.com/file/d/123')).toBe('DOCS')
    expect(detectArtifactKind('https://www.notion.so/team/Spec')).toBe('DOCS')
    expect(detectArtifactKind('https://internal.example.com/wiki/Home')).toBe('DOCS')
    expect(detectArtifactKind('https://youtu.be/demo-1')).toBe('OTHER_LINK')
    expect(detectArtifactKind(null)).toBe('OTHER_LINK')
  })

  it('ghi đè kind theo URL chứ không tin type backend gửi, và chuyển URL javascript: thành null', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [{ id: '10', phaseId: 'p1', code: 'T-10', title: 'Task', status: 'DONE', createdAt: '2026-11-01T00:00:00Z' }],
        dependencies: [],
      },
      artifacts: [
        {
          id: 'a1',
          name: 'Figma mislabeled as PR',
          type: 'PR',
          url: 'https://www.figma.com/file/kit',
          nodeId: '10',
          createdAt: '2026-11-10T00:00:00Z',
        },
        {
          id: 'a2',
          name: 'XSS link',
          type: 'OTHER_LINK',
          url: 'javascript:alert(1)',
          nodeId: '10',
          createdAt: '2026-11-11T00:00:00Z',
        },
      ],
    })

    const model = buildGuestReport(dto)
    const xss = model.artifacts.find((a) => a.id === 'a2')!
    const figma = model.artifacts.find((a) => a.id === 'a1')!

    expect(xss.url).toBeNull()
    expect(xss.kind).toBe('OTHER_LINK')
    expect(figma.url).toBe('https://www.figma.com/file/kit')
    expect(figma.kind).toBe('FIGMA')
    expect(figma.host).toBe('figma.com')
    expect(figma.taskCode).toBe('T-10')
  })
})

describe('thành viên FORMER, VIEWER và người giao không còn trong members', () => {
  it('xử lý đúng assignee lạ -> Former member, giữ FORMER, ẩn VIEWER không có task nhưng giữ VIEWER có task', () => {
    const dto = makeBaseDto({
      members: [
        { id: 'u1', name: 'An Nguyễn', role: 'OWNER' },
        { id: 'u2', name: 'Cựu Thành Viên', role: 'FORMER' },
        { id: 'u3', name: 'Khách Xem Rỗng', role: 'VIEWER' },
        { id: 'u4', name: 'Khách Có Task', role: 'VIEWER' },
      ],
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Task of unknown',
            status: 'DONE',
            assignedUserId: 'u99',
            dueDate: '2026-11-10T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: '2026-11-09T05:00:00.000Z',
          },
          {
            id: '2',
            phaseId: 'p1',
            code: 'T-2',
            title: 'Task of viewer',
            status: 'TODO',
            assignedUserId: 'u4',
            dueDate: '2026-11-25T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    const rowIds = model.team.rows.map((r) => r.memberId)

    expect(rowIds).toContain('u1')
    expect(rowIds).toContain('u2') // FORMER dù 0 task vẫn giữ
    expect(rowIds).not.toContain('u3') // VIEWER 0 task bị bỏ
    expect(rowIds).toContain('u4') // VIEWER có task vẫn giữ
    expect(rowIds).toContain('u99') // assignee không trong members -> Former member

    const unknownRow = model.team.rows.find((r) => r.memberId === 'u99')!
    expect(unknownRow.member.name).toBe('Former member')
    expect(unknownRow.member.initials).toBe('FM')
    expect(unknownRow.member.role).toBe('FORMER')
    expect(model.membersById['u1'].initials).toBe('AN')
  })
})

describe('dự án COMPLETED còn task mở & artifact nodeId null', () => {
  it('dự án COMPLETED còn 1 task quá hạn thì completed === false và overdue.length === 1', () => {
    const dto = makeBaseDto({
      project: {
        name: 'Completed with open overdue',
        description: '',
        status: 'COMPLETED',
        createdAt: '2026-11-01T05:00:00.000Z',
        linkExpiresAt: null,
      },
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Done on time',
            status: 'DONE',
            assignedUserId: 'u1',
            dueDate: '2026-11-10T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: '2026-11-09T05:00:00.000Z',
          },
          {
            id: '2',
            phaseId: 'p1',
            code: 'T-2',
            title: 'Still open and overdue',
            status: 'IN_PROGRESS',
            assignedUserId: 'u1',
            dueDate: '2026-11-15T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.metrics.completed).toBe(false)
    expect(model.metrics.overdue).toHaveLength(1)
    expect(model.metrics.overdue[0].code).toBe('T-2')
    expect(model.metrics.attention).toHaveLength(1)
  })

  it('G34 bỏ trạng thái COMPLETED: dự án ACTIVE có mọi task DONE thì completed === true, chưa có task thì false', () => {
    const project = {
      name: 'All done',
      description: '',
      status: 'ACTIVE',
      createdAt: '2026-11-01T05:00:00.000Z',
      linkExpiresAt: null,
    }
    const done = {
      id: '1',
      phaseId: 'p1',
      code: 'T-1',
      title: 'Done on time',
      status: 'DONE',
      assignedUserId: 'u1',
      dueDate: '2026-11-10T05:00:00.000Z',
      createdAt: '2026-11-01T05:00:00.000Z',
      completedAt: '2026-11-09T05:00:00.000Z',
    }
    const graph = (nodes: (typeof done)[]) => ({
      phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
      phaseEdges: [],
      nodes,
      dependencies: [],
    })

    expect(buildGuestReport(makeBaseDto({ project, graph: graph([done]) })).metrics.completed).toBe(true)
    expect(buildGuestReport(makeBaseDto({ project, graph: graph([]) })).metrics.completed).toBe(false)
  })

  it('artifact có nodeId null giữ nguyên null chứ không ép thành chuỗi "null"', () => {
    const dto = makeBaseDto({
      artifacts: [
        {
          id: 'a-proj',
          name: 'Project architecture doc',
          type: 'DOCS',
          url: 'https://docs.google.com/document/d/proj',
          nodeId: null,
          createdAt: '2026-11-10T00:00:00Z',
        },
      ],
    })

    const model = buildGuestReport(dto)
    expect(model.artifacts).toHaveLength(1)
    expect(model.artifacts[0].nodeId).toBeNull()
    expect(model.artifacts[0].taskCode).toBe('')
  })
})

describe('verdict 2 ca biên khi thiếu dueDate hoặc completedAt', () => {
  it('phase mọi task DONE nhưng thiếu plannedEnd (không task nào có dueDate) -> verdict Completed (emerald)', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Done without due',
            status: 'DONE',
            dueDate: null,
            createdAt: '2026-11-01T05:00:00.000Z',
            startedAt: '2026-11-02T05:00:00.000Z',
            completedAt: '2026-11-10T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.phases[0].plannedEnd).toBeNull()
    expect(model.phases[0].verdict).toEqual({ label: 'Completed', tone: 'emerald' })
  })

  it('phase mọi task DONE nhưng thiếu end (thiếu completedAt) -> verdict Completed (emerald)', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Done without completedAt',
            status: 'DONE',
            dueDate: '2026-11-10T05:00:00.000Z',
            createdAt: '2026-11-01T05:00:00.000Z',
            completedAt: null,
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.phases[0].end).toBeNull()
    expect(model.phases[0].verdict).toEqual({ label: 'Completed', tone: 'emerald' })
  })

  it('phase đang chạy, không quá hạn và plannedEnd === null -> verdict In progress (blue)', () => {
    const dto = makeBaseDto({
      graph: {
        phases: [{ id: 'p1', name: 'P1', orderIndex: 0 }],
        phaseEdges: [],
        nodes: [
          {
            id: '1',
            phaseId: 'p1',
            code: 'T-1',
            title: 'Active no due',
            status: 'IN_PROGRESS',
            dueDate: null,
            createdAt: '2026-11-01T05:00:00.000Z',
            startedAt: '2026-11-10T05:00:00.000Z',
          },
        ],
        dependencies: [],
      },
    })

    const model = buildGuestReport(dto)
    expect(model.phases[0].plannedEnd).toBeNull()
    expect(model.phases[0].overdue).toBe(0)
    expect(model.phases[0].verdict).toEqual({ label: 'In progress', tone: 'blue' })
  })
})
