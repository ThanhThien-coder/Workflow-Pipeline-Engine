// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { usePhaseKanban } from '../usePhaseKanban'
import { workflowService } from '../../services/container'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import type { KanbanTask, UserSummary } from '../../types/kanban.types'
import type { MacroPhase } from '../../types/workflow.types'
import { ApiError } from '../../services/http/ApiError'

/** T4 (G10) — Kanban của phase: task lấy theo dự án + phase từ service, thành viên thật, không trộn node tạm. */

const PHASE: MacroPhase = {
  id: '56', name: 'PHASE 4', sub: 'Cụm công việc 4', status: 'TODO', pct: 0, accent: 'slate', w: 380, h: 180, parentPhaseIds: [],
}

function task(id: string, status: KanbanTask['status'], assignedUserId = ''): KanbanTask {
  return {
    id, code: `WPE-${id}`, title: `Task ${id}`, description: '', status, assignedUserId, phaseId: 'P1', phaseLabel: 'Phase 56',
    dueDate: '2026-11-20T00:00:00Z', isOverdue: false, joinPolicySummary: '', artifacts: [], version: 0,
  }
}

const OWNER: UserSummary = {
  id: '9', name: 'a', roleTitle: 'OWNER', initials: 'A', avatarClass: 'bg-indigo-500', projectRole: 'OWNER', assignedTaskCount: 0,
}

describe('usePhaseKanban', () => {
  beforeEach(() => {
    useWorkflowStore.setState((state) => ({
      trees: {},
      project: { ...state.project, members: [OWNER] },
      kanban: { ...state.kanban, currentUserId: '9', tasks: [] },
    }))
  })

  afterEach(() => vi.restoreAllMocks())

  it('tải task theo đúng dự án và phase; giữ LOCKED và task chưa giao; nhãn phase lấy từ phase thật', async () => {
    const getPhaseTasks = vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('1', 'LOCKED'), task('2', 'TODO', '9')])

    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))

    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(2))
    expect(getPhaseTasks).toHaveBeenCalledWith('19', '56')
    expect(result.current.phaseTasks.map((t) => [t.status, t.assignedUserId])).toEqual([['LOCKED', ''], ['TODO', '9']])
    expect(result.current.phaseTasks[0].phaseLabel).toBe('Cụm công việc 4')
  })

  it('chưa có dự án thì không gọi API', async () => {
    const getPhaseTasks = vi.spyOn(workflowService, 'getPhaseTasks')

    const { result } = renderHook(() => usePhaseKanban(PHASE, null))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getPhaseTasks).not.toHaveBeenCalled()
    expect(result.current.phaseTasks).toEqual([])
  })

  it('người thao tác là người đăng nhập trong danh sách thành viên thật; không phải thành viên thì null', async () => {
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([])
    const { result, rerender } = renderHook(() => usePhaseKanban(PHASE, '19'))
    expect(result.current.actor?.name).toBe('a')

    act(() => useWorkflowStore.setState((state) => ({ kanban: { ...state.kanban, currentUserId: '1' } })))
    rerender()
    expect(result.current.actor).toBeNull()
  })

  it('task đang khóa không đổi được trạng thái, không gọi API', async () => {
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('1', 'LOCKED', '9')])
    const update = vi.spyOn(workflowService, 'updateTaskStatus')
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(1))

    await act(() => result.current.moveTask('1', 'IN_PROGRESS'))

    expect(update).not.toHaveBeenCalled()
    expect(result.current.phaseTasks[0].status).toBe('LOCKED')
  })

  it('đổi trạng thái thành công: dùng bản backend trả về rồi đọc lại cây phase (task con có thể vừa mở khóa)', async () => {
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('2', 'TODO', '9')])
    vi.spyOn(workflowService, 'updateTaskStatus').mockResolvedValue(task('2', 'IN_PROGRESS', '9'))
    const resetPhaseTree = vi.fn(async () => {})
    useWorkflowStore.setState({ resetPhaseTree })
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(1))

    await act(() => result.current.moveTask('2', 'IN_PROGRESS'))

    expect(result.current.phaseTasks[0].status).toBe('IN_PROGRESS')
    expect(resetPhaseTree).toHaveBeenCalledWith('56')
  })

  it('sau F5: người thao tác lấy theo auth.currentUser, không theo kanban.currentUserId mặc định "1"', async () => {
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([])
    useWorkflowStore.setState((state) => ({
      kanban: { ...state.kanban, currentUserId: '1' },
      auth: { ...state.auth, currentUser: { id: '9', username: 'a', email: 'a@x.io', systemRole: 'USER' } as never },
    }))
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    expect(result.current.actor?.id).toBe('9')
    useWorkflowStore.setState((state) => ({ auth: { ...state.auth, currentUser: null } }))
  })

  it('REVIEW -> IN_PROGRESS không có lý do: không gọi API; có lý do: updateTaskStatus(id, IN_PROGRESS, lý do)', async () => {
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('3', 'REVIEW', '5')])
    const update = vi.spyOn(workflowService, 'updateTaskStatus').mockResolvedValue(task('3', 'IN_PROGRESS', '5'))
    useWorkflowStore.setState({ resetPhaseTree: vi.fn(async () => {}) })
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(1))

    await act(() => result.current.moveTask('3', 'IN_PROGRESS'))
    expect(update).not.toHaveBeenCalled()

    await act(() => result.current.moveTask('3', 'IN_PROGRESS', 'Thiếu test'))
    expect(update).toHaveBeenCalledWith('3', 'IN_PROGRESS', 'Thiếu test')
  })

  it('409 khi đổi trạng thái: tải lại task của phase, hoàn lại thẻ và báo bản cũ', async () => {
    const getPhaseTasks = vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('2', 'TODO', '9')])
    vi.spyOn(workflowService, 'updateTaskStatus').mockRejectedValue(new ApiError({ status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT', message: 'x' }))
    useWorkflowStore.setState({ resetPhaseTree: vi.fn(async () => {}) })
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(1))
    expect(getPhaseTasks).toHaveBeenCalledTimes(1)

    await act(() => result.current.moveTask('2', 'IN_PROGRESS'))

    expect(getPhaseTasks).toHaveBeenCalledTimes(2)
    expect(result.current.phaseTasks[0].status).toBe('TODO')
    expect(result.current.toastMessage).toBe('This task was changed by someone else. The board has been refreshed, please try again.')
  })

  it('409 khi đổi người được giao: tải lại task của phase', async () => {
    const getPhaseTasks = vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([task('2', 'TODO', '9')])
    vi.spyOn(workflowService, 'updateTaskAssignment').mockRejectedValue(new ApiError({ status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT', message: 'x' }))
    const { result } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(result.current.phaseTasks).toHaveLength(1))

    let ok = true
    await act(async () => { ok = await result.current.updateAssignment('2', { assignedUserId: '9' }) })

    expect(ok).toBe(false)
    expect(getPhaseTasks).toHaveBeenCalledTimes(2)
    expect(result.current.toastMessage).toContain('changed by someone else')
  })

  it('không còn tự mở kết nối realtime (đã chuyển sang useProjectRealtime)', () => {
    const connectRealtime = vi.fn(() => vi.fn())
    ;(workflowService as any).connectRealtime = connectRealtime
    vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([])

    renderHook(() => usePhaseKanban(PHASE, '19'))

    expect(connectRealtime).not.toHaveBeenCalled()
  })

  it('S03: đổi tọa độ thẻ thì không tải lại; đổi trạng thái / thêm task thì tải lại 1 lần (gộp 300ms)', async () => {
    const mk = (id: string, status: string, x = 0) =>
      ({ id, kind: 'branch', code: id, title: `T${id}`, description: '', isTrack: false, status, assignee: null, due: null, blocker: null, joinPolicy: 'ALL_COMPLETED', parentIds: ['root_56'], x, y: 0 }) as never
    useWorkflowStore.setState({ trees: { '56': { root_56: { id: 'root_56', kind: 'root', title: 'P', parentIds: [] }, '1': mk('1', 'TODO') } } })
    cleanup() // gỡ các hook còn treo từ test trước (chúng cũng nghe store)
    const getPhaseTasks = vi.spyOn(workflowService, 'getPhaseTasks').mockResolvedValue([])

    const { rerender } = renderHook(() => usePhaseKanban(PHASE, '19'))
    await waitFor(() => expect(getPhaseTasks).toHaveBeenCalledTimes(1))

    // Chỉ đổi tọa độ
    act(() => {
      useWorkflowStore.setState((s) => ({ trees: { '56': { ...s.trees['56'], '1': mk('1', 'TODO', 500) } } }))
    })
    rerender()
    await new Promise((r) => setTimeout(r, 450))
    expect(getPhaseTasks).toHaveBeenCalledTimes(1)

    // Thêm task rồi đổi trạng thái liên tiếp: gộp thành 1 lần tải
    act(() => {
      useWorkflowStore.setState((s) => ({ trees: { '56': { ...s.trees['56'], '2': mk('2', 'LOCKED') } } }))
    })
    act(() => {
      useWorkflowStore.setState((s) => ({ trees: { '56': { ...s.trees['56'], '2': mk('2', 'TODO') } } }))
    })
    await waitFor(() => expect(getPhaseTasks).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await new Promise((r) => setTimeout(r, 450))
    expect(getPhaseTasks).toHaveBeenCalledTimes(2)
  })
})
