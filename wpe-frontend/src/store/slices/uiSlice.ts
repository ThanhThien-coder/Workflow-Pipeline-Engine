export interface ToastData {
  message: string
  durationMs: number
}

export interface UiState {
  toast: ToastData | null
  /** Task cần làm nổi trên cây (kết quả tìm kiếm); MindmapTree dùng xong thì đặt lại null. */
  highlightNodeId: string | null
}

export interface UiSlice {
  ui: UiState & {
    showToast: (message: string, durationMs?: number) => void
    dismissToast: () => void
    setHighlightNodeId: (nodeId: string | null) => void
  }
}

type UiSetter = (
  partial: Partial<UiSlice> | ((state: UiSlice) => Partial<UiSlice>),
) => void

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const createUiSlice = (set: UiSetter, get: () => UiSlice): UiSlice => ({
  ui: {
    toast: null,
    highlightNodeId: null,

    showToast: (message: string, durationMs = 3000) => {
      if (toastTimer) {
        clearTimeout(toastTimer)
        toastTimer = null
      }

      set((state) => ({
        ui: {
          ...state.ui,
          toast: { message, durationMs },
        },
      }))

      toastTimer = setTimeout(() => {
        get().ui.dismissToast()
      }, durationMs)
    },

    dismissToast: () => {
      if (toastTimer) {
        clearTimeout(toastTimer)
        toastTimer = null
      }

      set((state) => ({
        ui: {
          ...state.ui,
          toast: null,
        },
      }))
    },

    setHighlightNodeId: (nodeId: string | null) => {
      set((state) => ({ ui: { ...state.ui, highlightNodeId: nodeId } }))
    },
  },
})
