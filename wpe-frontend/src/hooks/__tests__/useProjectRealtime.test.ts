// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

type Handler = (eventName: string, data: unknown) => void
let handler: Handler = () => {}
const unsubscribe = vi.fn()
const navigateMock = vi.fn()

vi.mock('../../services/env', () => ({ isMockMode: false }))
vi.mock('../../services/realtime/realtimeHub', () => ({
  realtimeHub: {
    subscribe: (h: Handler) => {
      handler = h
      return unsubscribe
    },
  },
}))
vi.mock('../../router/useRouter', () => ({ navigate: (to: string) => navigateMock(to) }))
// Thời điểm tab này gửi request ghi gần nhất (để biết sự kiện "của mình" có phải từ tab này không)
const writeClock = vi.hoisted(() => ({ lastWriteAt: 0 }))
vi.mock('../../services/http/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/http/apiClient')>()),
  getLastLocalWriteAt: () => writeClock.lastWriteAt,
}))

import { useProjectRealtime } from '../useProjectRealtime'
import { useWorkflowStore } from '../../store/useWorkflowStore'

const spies = {
  loadPhases: vi.fn(async () => {}),
  loadProject: vi.fn(async () => {}),
  loadMembers: vi.fn(async () => {}),
  loadTasks: vi.fn(async () => {}),
  loadReviewTasks: vi.fn(async () => {}),
  loadSettings: vi.fn(async () => {}),
  loadArtifacts: vi.fn(async () => {}),
  overviewLoad: vi.fn(async () => {}),
  showToast: vi.fn(),
}

function setStore(opts: { myRole?: string; settingsId?: string | null; overviewProjectId?: string | null } = {}) {
  useWorkflowStore.setState((s) => ({
    ...s,
    loadPhases: spies.loadPhases,
    auth: { ...s.auth, currentUser: { id: '7' } as never },
    ui: { ...s.ui, showToast: spies.showToast },
    project: { ...s.project, info: { myRole: opts.myRole ?? 'COLLABORATOR' } as never, loadProject: spies.loadProject },
    kanban: { ...s.kanban, loadMembers: spies.loadMembers, loadTasks: spies.loadTasks, loadReviewTasks: spies.loadReviewTasks },
    settings: { ...s.settings, settings: opts.settingsId ? ({ id: opts.settingsId } as never) : null, loadSettings: spies.loadSettings },
    artifacts: { ...s.artifacts, loadArtifacts: spies.loadArtifacts },
    overview: { ...s.overview, projectId: opts.overviewProjectId ?? null, load: spies.overviewLoad },
  }))
}

const changed = (resource: string, extra: Record<string, unknown> = {}) =>
  act(() => handler('PROJECT_CHANGED', { projectId: '19', resource, reason: 'X', actorUserId: '8', phaseId: null, taskId: null, ...extra }))
const wait = (ms = 400) => act(() => { vi.advanceTimersByTime(ms) })

describe('useProjectRealtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    writeClock.lastWriteAt = 0
    Object.values(spies).forEach((s) => s.mockClear())
    unsubscribe.mockClear()
    navigateMock.mockClear()
    setStore()
  })
  afterEach(() => vi.useRealTimers())

  it('GRAPH -> loadPhases sau 400ms (không sớm hơn); người thường không tải review/tasks', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('GRAPH')
    wait(399)
    expect(spies.loadPhases).not.toHaveBeenCalled()
    wait(1)
    expect(spies.loadPhases).toHaveBeenCalledWith('19')
    expect(spies.loadTasks).not.toHaveBeenCalled()
    expect(spies.loadReviewTasks).not.toHaveBeenCalled()
  })

  it('PROJECT_TASKS_CHANGED được xử lý như GRAPH', () => {
    renderHook(() => useProjectRealtime('19'))
    act(() => handler('PROJECT_TASKS_CHANGED', { projectId: '19', phaseId: '1', taskId: '2', reason: 'S', actorUserId: null }))
    wait()
    expect(spies.loadPhases).toHaveBeenCalledTimes(1)
  })

  it('GRAPH + đang ở My Tasks -> thêm loadTasks; Owner/Manager -> thêm loadReviewTasks', () => {
    setStore({ myRole: 'MANAGER' })
    renderHook(() => useProjectRealtime('19', 'my-tasks'))
    changed('GRAPH')
    wait()
    expect(spies.loadTasks).toHaveBeenCalledWith('19')
    expect(spies.loadReviewTasks).toHaveBeenCalledWith('19')
  })

  it('3 sự kiện GRAPH liền nhau chỉ gọi loadPhases 1 lần', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('GRAPH')
    wait(100)
    changed('GRAPH')
    wait(100)
    act(() => handler('PROJECT_TASKS_CHANGED', { projectId: '19', actorUserId: '8' }))
    wait(400)
    expect(spies.loadPhases).toHaveBeenCalledTimes(1)
  })

  it('MEMBERS -> loadProject + loadMembers; settings chỉ tải khi đang là dự án này', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('MEMBERS')
    wait()
    expect(spies.loadProject).toHaveBeenCalledWith('19')
    expect(spies.loadMembers).toHaveBeenCalledWith('19')
    expect(spies.loadSettings).not.toHaveBeenCalled()

    setStore({ settingsId: '19' })
    changed('MEMBERS')
    wait()
    expect(spies.loadSettings).toHaveBeenCalledWith('19')
  })

  it('PROJECT -> loadProject (+ settings nếu đúng dự án), không loadMembers', () => {
    setStore({ settingsId: '19' })
    renderHook(() => useProjectRealtime('19'))
    changed('PROJECT', { reason: 'PROJECT_UPDATED' })
    wait()
    expect(spies.loadProject).toHaveBeenCalledWith('19')
    expect(spies.loadSettings).toHaveBeenCalledWith('19')
    expect(spies.loadMembers).not.toHaveBeenCalled()
  })

  it('MEMBERS + PROJECT cùng lúc chỉ gọi loadProject 1 lần', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('MEMBERS')
    changed('PROJECT')
    wait()
    expect(spies.loadProject).toHaveBeenCalledTimes(1)
  })

  it('PROJECT_DELETED -> toast + về /workspaces, không tải lại gì', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('PROJECT', { reason: 'PROJECT_DELETED' })
    expect(spies.showToast).toHaveBeenCalledWith('This project was deleted.')
    expect(navigateMock).toHaveBeenCalledWith('/workspaces')
    wait()
    expect(spies.loadProject).not.toHaveBeenCalled()
  })

  it('ARTIFACTS -> loadArtifacts', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('ARTIFACTS')
    wait()
    expect(spies.loadArtifacts).toHaveBeenCalledWith('19')
  })

  it('FEEDBACK và AI -> overview.load chỉ khi Overview đã tải cho dự án này', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('FEEDBACK')
    changed('AI')
    wait()
    expect(spies.overviewLoad).not.toHaveBeenCalled()

    setStore({ overviewProjectId: '19' })
    changed('FEEDBACK')
    changed('AI')
    wait()
    expect(spies.overviewLoad).toHaveBeenCalledTimes(1)
    expect(spies.overviewLoad).toHaveBeenCalledWith('19')
  })

  it('sự kiện do chính mình gây ra từ CHÍNH TAB NÀY (vừa gửi request ghi) bị bỏ qua', () => {
    writeClock.lastWriteAt = Date.now()
    renderHook(() => useProjectRealtime('19'))
    changed('GRAPH', { actorUserId: '7' })
    act(() => handler('PROJECT_TASKS_CHANGED', { projectId: '19', actorUserId: '7' }))
    wait()
    expect(spies.loadPhases).not.toHaveBeenCalled()
  })

  it('cùng tài khoản nhưng tab khác (tab này không gửi request ghi gần đây) -> vẫn tải lại', () => {
    writeClock.lastWriteAt = Date.now() - 60_000
    renderHook(() => useProjectRealtime('19'))
    changed('GRAPH', { actorUserId: '7' })
    wait()
    expect(spies.loadPhases).toHaveBeenCalledTimes(1)
  })

  it('TASK_OVERDUE của task thuộc phase dự án đang mở -> tải lại đồ thị; phase lạ -> bỏ qua', () => {
    useWorkflowStore.setState({ macroPhases: [{ id: '40' } as never] })
    renderHook(() => useProjectRealtime('19'))
    act(() => handler('TASK_OVERDUE', { id: '5', phaseId: '999' }))
    wait()
    expect(spies.loadPhases).not.toHaveBeenCalled()
    act(() => handler('TASK_OVERDUE', { id: '5', phaseId: '40' }))
    wait()
    expect(spies.loadPhases).toHaveBeenCalledTimes(1)
  })

  it('actorUserId null (khách / job nền) vẫn được xử lý', () => {
    setStore({ overviewProjectId: '19' })
    renderHook(() => useProjectRealtime('19'))
    changed('FEEDBACK', { actorUserId: null })
    wait()
    expect(spies.overviewLoad).toHaveBeenCalledTimes(1)
  })

  it('dự án khác, resource lạ, sự kiện khác tên -> bỏ qua', () => {
    renderHook(() => useProjectRealtime('19'))
    changed('GRAPH', { projectId: '999' })
    changed('LA')
    act(() => handler('TASK_STATUS_CHANGED', { projectId: '19' }))
    wait()
    expect(spies.loadPhases).not.toHaveBeenCalled()
  })

  it('unmount hủy đăng ký và hủy lần tải đang chờ', () => {
    const { unmount } = renderHook(() => useProjectRealtime('19'))
    changed('GRAPH')
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
    wait()
    expect(spies.loadPhases).not.toHaveBeenCalled()
  })
})
