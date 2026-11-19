import { useEffect, useRef } from 'react'
import { realtimeHub } from '../services/realtime/realtimeHub'
import { isMockMode } from '../services/env'
import { navigate } from '../router/useRouter'
import { useWorkflowStore, type NavigationTab } from '../store/useWorkflowStore'
import { getLastLocalWriteAt } from '../services/http/apiClient'

/** Gộp các sự kiện đến trong khoảng này thành một lần tải lại (chủ dự án kéo thẻ liên tục không làm gọi API dồn dập). */
export const PROJECT_REALTIME_DEBOUNCE_MS = 400

/**
 * Sự kiện có actorUserId = mình chỉ bỏ qua khi CHÍNH TAB NÀY vừa gửi request ghi trong khoảng này
 * (giao diện tab này đã tự cập nhật). Cùng tài khoản mở tab khác thì tab kia vẫn tải lại.
 */
export const OWN_EVENT_WINDOW_MS = 5000

type Resource = 'GRAPH' | 'MEMBERS' | 'PROJECT' | 'ARTIFACTS' | 'FEEDBACK' | 'AI'

const RESOURCES: readonly string[] = ['GRAPH', 'MEMBERS', 'PROJECT', 'ARTIFACTS', 'FEEDBACK', 'AI']

interface ProjectEventPayload {
  projectId?: string | null
  resource?: string | null
  reason?: string | null
  actorUserId?: string | null
}

/** Tải lại đúng phần dữ liệu tương ứng với các resource đã gộp (mỗi phần tối đa 1 lần). */
function refresh(projectId: string, resources: ReadonlySet<Resource>, currentTab: NavigationTab | undefined): void {
  const state = useWorkflowStore.getState()
  const quiet = (p: Promise<unknown> | void) => {
    if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => {})
  }

  if (resources.has('GRAPH')) {
    quiet(state.loadPhases(projectId))
    if ((currentTab ?? state.activeTab) === 'my-tasks') quiet(state.kanban.loadTasks(projectId))
    const myRole = state.project.info?.myRole
    if (myRole === 'OWNER' || myRole === 'MANAGER') quiet(state.kanban.loadReviewTasks(projectId))
  }

  const projectChanged = resources.has('MEMBERS') || resources.has('PROJECT')
  if (projectChanged) {
    quiet(state.project.loadProject(projectId))
    if (resources.has('MEMBERS')) quiet(state.kanban.loadMembers(projectId))
    if (state.settings.settings != null && String(state.settings.settings.id) === projectId) {
      quiet(state.settings.loadSettings(projectId))
    }
  }

  if (resources.has('ARTIFACTS')) quiet(state.artifacts.loadArtifacts(projectId))

  if ((resources.has('FEEDBACK') || resources.has('AI')) && state.overview.projectId === projectId) {
    quiet(state.overview.load(projectId))
  }
}

/**
 * Nghe realtime cấp dự án (gắn 1 lần ở ProjectWorkspaceView). Chỉ xử lý sự kiện của dự án đang mở,
 * bỏ qua sự kiện do chính người đang đăng nhập gây ra (giao diện của mình đã tự cập nhật), rồi tải lại đúng phần vừa đổi.
 */
export function useProjectRealtime(projectId: string | null | undefined, currentTab?: NavigationTab): void {
  // Tab hiện tại đọc qua ref để đổi tab không phải đăng ký lại và không làm mất sự kiện đang chờ gộp
  const tabRef = useRef(currentTab)
  tabRef.current = currentTab

  useEffect(() => {
    if (!projectId || isMockMode) return
    const pid = String(projectId)

    const pending = new Set<Resource>()
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      timer = null
      const batch = new Set(pending)
      pending.clear()
      if (batch.size > 0) refresh(pid, batch, tabRef.current)
    }

    const schedule = (resource: Resource) => {
      pending.add(resource)
      if (timer === null) timer = setTimeout(flush, PROJECT_REALTIME_DEBOUNCE_MS)
    }

    const unsubscribe = realtimeHub.subscribe((eventName, data) => {
      // Job quét quá hạn chỉ gửi TASK_OVERDUE (không kèm PROJECT_TASKS_CHANGED): task thuộc phase của dự án đang mở thì tải lại đồ thị
      if (eventName === 'TASK_OVERDUE') {
        const phaseId = (data as { phaseId?: string | null } | null)?.phaseId
        if (phaseId && useWorkflowStore.getState().macroPhases.some((p) => p.id === String(phaseId))) schedule('GRAPH')
        return
      }
      if (eventName !== 'PROJECT_TASKS_CHANGED' && eventName !== 'PROJECT_CHANGED') return
      const payload = (data ?? {}) as ProjectEventPayload
      if (payload.projectId == null || String(payload.projectId) !== pid) return

      const me = useWorkflowStore.getState().auth.currentUser?.id
      const ownEvent = payload.actorUserId != null && me != null && String(payload.actorUserId) === String(me)
      if (ownEvent && Date.now() - getLastLocalWriteAt() < OWN_EVENT_WINDOW_MS) return

      const resource = eventName === 'PROJECT_TASKS_CHANGED' ? 'GRAPH' : payload.resource ?? ''
      if (!RESOURCES.includes(resource)) return

      if (resource === 'PROJECT' && payload.reason === 'PROJECT_DELETED') {
        if (timer !== null) clearTimeout(timer)
        timer = null
        pending.clear()
        useWorkflowStore.getState().ui.showToast('This project was deleted.')
        navigate('/workspaces')
        return
      }

      schedule(resource as Resource)
    })

    return () => {
      if (timer !== null) clearTimeout(timer)
      pending.clear()
      unsubscribe()
    }
  }, [projectId])
}
