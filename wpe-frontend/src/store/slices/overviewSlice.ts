import type { OverviewData } from '../../types/overview.types'
import type { IWorkflowService } from '../../services/contracts/IWorkflowService'
import { workflowService } from '../../services/container'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface OverviewSlice {
  overview: {
    projectId: string | null
    data: OverviewData | null
    status: LoadStatus
    error: string | null
    toast: string | null
    load: (projectId: string) => Promise<void>
    resolveFeedback: (feedbackId: string, projectId?: string) => Promise<void>
    revokeGuest: (projectId?: string) => Promise<void>
    generateGuest: (projectId?: string) => Promise<void>
    showToast: (message: string) => void
    reset: () => void
  }
}

type OverviewSetter = (
  partial: Partial<OverviewSlice> | ((state: OverviewSlice) => Partial<OverviewSlice>),
) => void

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function resolveOverviewProjectId(get: () => OverviewSlice, explicitProjectId?: string): string | null {
  const state = get() as OverviewSlice & { currentProjectId?: string | null }
  return explicitProjectId || state.overview.projectId || state.currentProjectId || state.overview.data?.project.id || null
}

export const createOverviewSlice = (
  set: OverviewSetter,
  get: () => OverviewSlice,
  service: IWorkflowService = workflowService,
): OverviewSlice => ({
  overview: {
    projectId: null,
    data: null,
    status: 'idle',
    error: null,
    toast: null,
    load: async (projectId) => {
      set((state) => {
        const isDifferentProject = state.overview.projectId !== projectId
        return {
          overview: {
            ...state.overview,
            projectId,
            data: isDifferentProject ? null : state.overview.data,
            status: 'loading',
            error: null,
          },
        }
      })
      try {
        const data = await service.getOverviewData(projectId)
        set((state) => {
          if (state.overview.projectId !== projectId) return state
          return { overview: { ...state.overview, projectId, data, status: 'ready' } }
        })
      } catch (error) {
        const message = extractErrorMessage(error, 'Không tải được dữ liệu Overview')
        set((state) => {
          if (state.overview.projectId !== projectId) return state
          return { overview: { ...state.overview, projectId, status: 'error', error: message } }
        })
      }
    },
    resolveFeedback: async (feedbackId: string, projectId?: string) => {
      const targetProjectId = resolveOverviewProjectId(get, projectId)
      if (!targetProjectId) return
      try {
        await service.resolveFeedback(targetProjectId, feedbackId)
        set((state) => {
          if (!state.overview.data) return state
          const updatedFeedback = state.overview.data.feedbackQueue.map((item) =>
            item.id === feedbackId ? { ...item, status: 'RESOLVED' as const } : item,
          )
          return {
            overview: {
              ...state.overview,
              data: {
                ...state.overview.data,
                feedbackQueue: updatedFeedback,
              },
            },
          }
        })
        get().overview.showToast('Feedback đã được đánh dấu giải quyết (Resolved).')
      } catch (error) {
        get().overview.showToast(
          extractErrorMessage(error, 'Không thể giải quyết phản hồi. Vui lòng thử lại.'),
        )
      }
    },
    revokeGuest: async (projectId?: string) => {
      const targetProjectId = resolveOverviewProjectId(get, projectId)
      const data = get().overview.data
      if (!targetProjectId) return
      const previous = data?.guestAccess
      if (previous) {
        set((state) => ({
          overview: {
            ...state.overview,
            data: state.overview.data
              ? { ...state.overview.data, guestAccess: { ...previous, isActive: false } }
              : null,
          },
        }))
      }
      try {
        const guestAccess = await service.toggleGuestAccess(targetProjectId, false)
        set((state) => ({
          overview: {
            ...state.overview,
            data: state.overview.data ? { ...state.overview.data, guestAccess } : null,
          },
        }))
        get().overview.showToast('Guest access revoked. Previous link is no longer accessible.')
      } catch (error) {
        if (previous) {
          set((state) => ({
            overview: {
              ...state.overview,
              data: state.overview.data ? { ...state.overview.data, guestAccess: previous } : null,
            },
          }))
        }
        get().overview.showToast(
          extractErrorMessage(error, 'Failed to revoke link. Please try again.'),
        )
      }
    },
    generateGuest: async (projectId?: string) => {
      const targetProjectId = resolveOverviewProjectId(get, projectId)
      if (!targetProjectId) return
      try {
        const guestAccess = await service.generateGuestToken(targetProjectId)
        set((state) => ({
          overview: {
            ...state.overview,
            data: state.overview.data ? { ...state.overview.data, guestAccess } : null,
          },
        }))
        get().overview.showToast('New guest access link generated.')
      } catch (error) {
        get().overview.showToast(
          extractErrorMessage(error, 'Failed to generate new link. Please try again.'),
        )
      }
    },
    showToast: (message) => {
      set((state) => ({ overview: { ...state.overview, toast: message } }))
      setTimeout(() => {
        if (get().overview.toast === message) {
          set((state) => ({ overview: { ...state.overview, toast: null } }))
        }
      }, 2400)
    },
    reset: () =>
      set((state) => ({
        overview: { ...state.overview, projectId: null, data: null, status: 'idle', error: null },
      })),
  },
})
