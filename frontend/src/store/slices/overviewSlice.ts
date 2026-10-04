import type { OverviewData } from '../../types/overview.types'
import { workflowService } from '../../services/container'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface OverviewSlice {
  overview: {
    data: OverviewData | null
    status: LoadStatus
    error: string | null
    toast: string | null
    load: (projectId: string) => Promise<void>
    revokeGuest: () => Promise<void>
    generateGuest: () => Promise<void>
    showToast: (message: string) => void
    reset: () => void
  }
}

type OverviewSetter = (
  partial: Partial<OverviewSlice> | ((state: OverviewSlice) => Partial<OverviewSlice>),
) => void

export const createOverviewSlice = (set: OverviewSetter, get: () => OverviewSlice): OverviewSlice => ({
  overview: {
    data: null,
    status: 'idle',
    error: null,
    toast: null,
    load: async (projectId) => {
      set((state) => ({ overview: { ...state.overview, status: 'loading', error: null } }))
      try {
        const data = await workflowService.getOverviewData(projectId)
        set((state) => ({ overview: { ...state.overview, data, status: 'ready' } }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không tải được dữ liệu'
        set((state) => ({ overview: { ...state.overview, status: 'error', error: message } }))
      }
    },
    revokeGuest: async () => {
      const data = get().overview.data
      if (!data) return
      const previous = data.guestAccess
      set((state) => ({ overview: { ...state.overview, data: state.overview.data ? { ...state.overview.data, guestAccess: { ...previous, isActive: false } } : null } }))
      try {
        const guestAccess = await workflowService.toggleGuestAccess(data.project.id, false)
        set((state) => ({ overview: { ...state.overview, data: state.overview.data ? { ...state.overview.data, guestAccess } : null } }))
        get().overview.showToast('Đã vô hiệu hóa token. Liên kết cũ không còn truy cập được.')
      } catch {
        set((state) => ({ overview: { ...state.overview, data: state.overview.data ? { ...state.overview.data, guestAccess: previous } : null } }))
        get().overview.showToast('Không thể đóng liên kết. Vui lòng thử lại.')
      }
    },
    generateGuest: async () => {
      const data = get().overview.data
      if (!data) return
      try {
        const guestAccess = await workflowService.generateGuestToken(data.project.id)
        set((state) => ({ overview: { ...state.overview, data: state.overview.data ? { ...state.overview.data, guestAccess } : null } }))
        get().overview.showToast('Đã tạo liên kết mới (Generate New Token)')
      } catch {
        get().overview.showToast('Không thể tạo liên kết mới. Vui lòng thử lại.')
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
    reset: () => set((state) => ({ overview: { ...state.overview, data: null, status: 'idle', error: null } })),
  },
})
