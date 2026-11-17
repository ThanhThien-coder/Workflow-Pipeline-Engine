import type { OverviewData } from '../../types/overview.types'
import type { IWorkflowService } from '../../services/contracts/IWorkflowService'
import { workflowService } from '../../services/container'
import { isApiError } from '../../services/http/ApiError'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface OverviewSlice {
  overview: {
    projectId: string | null
    data: OverviewData | null
    status: LoadStatus
    error: string | null
    toast: string | null
    aiScanning: boolean
    aiScanError: string | null
    load: (projectId: string) => Promise<void>
    resolveFeedback: (feedbackId: string, projectId?: string) => Promise<void>
    revokeGuest: (projectId?: string) => Promise<void>
    generateGuest: (projectId?: string) => Promise<void>
    runAiDiagnosis: (projectId?: string) => Promise<void>
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
    aiScanning: false,
    aiScanError: null,
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
            ...(isDifferentProject ? { aiScanning: false, aiScanError: null } : {}),
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
        const message = extractErrorMessage(error, 'Couldn\'t load the Overview data.')
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
        get().overview.showToast('Feedback marked as resolved.')
      } catch (error) {
        get().overview.showToast(
          extractErrorMessage(error, 'Couldn\'t resolve the feedback. Please try again.'),
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
    runAiDiagnosis: async (projectId?: string) => {
      const targetProjectId = resolveOverviewProjectId(get, projectId)
      if (!targetProjectId) return
      if (get().overview.aiScanning) return

      set((state) => ({
        overview: { ...state.overview, aiScanning: true, aiScanError: null },
      }))

      try {
        const report = await service.runAiDiagnosis(targetProjectId)
        set((state) => {
          if (state.overview.projectId !== targetProjectId || !state.overview.data) {
            return state
          }
          return {
            overview: {
              ...state.overview,
              data: {
                ...state.overview.data,
                aiReport: report,
              },
            },
          }
        })
      } catch (error) {
        if (get().overview.projectId === targetProjectId) {
          let message = 'Could not run AI diagnosis. Please try again.'
          if (isApiError(error)) {
            if (error.status === 429) {
              if (typeof error.retryAfterSeconds === 'number' && Number.isFinite(error.retryAfterSeconds)) {
                message = `AI diagnosis was run recently. Try again in ${error.retryAfterSeconds}s.`
              } else {
                message = 'AI diagnosis was run recently. Try again in a few minutes.'
              }
            } else if (error.status === 403) {
              message = 'You do not have permission to run AI diagnosis for this project.'
            } else if (error.status === 503) {
              message = 'AI service is unavailable right now. Please try again later.'
            }
          }
          set((state) => {
            if (state.overview.projectId !== targetProjectId) return state
            return {
              overview: { ...state.overview, aiScanError: message },
            }
          })
        }
      } finally {
        if (get().overview.projectId === targetProjectId) {
          set((state) => {
            if (state.overview.projectId !== targetProjectId) return state
            return {
              overview: { ...state.overview, aiScanning: false },
            }
          })
        }
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
        overview: {
          ...state.overview,
          projectId: null,
          data: null,
          status: 'idle',
          error: null,
          aiScanning: false,
          aiScanError: null,
        },
      })),
  },
})
