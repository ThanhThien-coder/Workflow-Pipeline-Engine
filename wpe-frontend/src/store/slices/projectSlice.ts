import type { IWorkflowService } from '../../services/contracts/IWorkflowService'
import { workflowService } from '../../services/container'
import { isApiError } from '../../services/http/ApiError'
import type { ProjectSettingsDto } from '../../types/settings.types'
import type { UserSummary } from '../../types/kanban.types'
import type { LoadStatus } from './overviewSlice'

/**
 * Dự án đang mở (/project/:id/*): thông tin chung (tên, trạng thái, vai trò của tôi) và thành viên.
 * Tải một lần khi vào dự án; thanh bên, chọn người làm, Kanban cùng đọc từ đây.
 */
export interface ProjectSlice {
  project: {
    projectId: string | null
    info: ProjectSettingsDto | null
    members: UserSummary[]
    status: LoadStatus
    error: string | null
    loadProject: (projectId: string) => Promise<void>
  }
}

type ProjectSetter = (update: (state: ProjectSlice) => Partial<ProjectSlice>) => void

export const createProjectSlice = (
  set: ProjectSetter,
  get: () => ProjectSlice,
  service: IWorkflowService = workflowService,
): ProjectSlice => {
  const patch = (changes: Partial<Omit<ProjectSlice['project'], 'loadProject'>>) =>
    set((state) => ({ project: { ...state.project, ...changes } }))

  return {
    project: {
      projectId: null,
      info: null,
      members: [],
      status: 'idle',
      error: null,

      loadProject: async (projectId: string) => {
        const switching = get().project.projectId !== projectId
        patch({
          projectId,
          status: 'loading',
          error: null,
          ...(switching ? { info: null, members: [] } : {}),
        })

        try {
          const [info, members] = await Promise.all([
            service.getProjectSettings(projectId),
            service.getProjectMembers(projectId),
          ])
          if (get().project.projectId !== projectId) return
          patch({ info, members, status: 'ready' })
        } catch (error) {
          if (get().project.projectId !== projectId) return
          const message = isApiError(error) || error instanceof Error ? error.message : 'Could not load project details'
          patch({ info: null, members: [], status: 'error', error: message })
        }
      },
    },
  }
}
