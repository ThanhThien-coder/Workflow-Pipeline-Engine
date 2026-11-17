import { useCallback, useState } from 'react'
import { isApiError } from '../../services/http/ApiError'
import { GRAPH_READ_ONLY_MESSAGE, useWorkflowStore } from '../../store/useWorkflowStore'

/**
 * B5 — Câu báo cho người dùng theo ApiError.code khi thao tác đồ thị lỗi.
 * 403/409 (và lỗi khác) hiện toast; 422 chu trình thì mở KahnCycleModal (xem useGraphErrorHandler).
 */
export function graphErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'ACCESS_DENIED':
      case 'GRAPH_READ_ONLY':
        return `${GRAPH_READ_ONLY_MESSAGE}.`
      case 'PROJECT_ARCHIVED':
        return 'This project is archived. The graph is read-only.'
      case 'NETWORK_ERROR':
        return 'Lost connection to the server. Your changes have not been saved.'
      case 'CYCLE_DETECTED':
        return 'Can\'t connect these tasks: this would create a dependency cycle.'
      default:
        return error.message || 'Couldn\'t save your graph changes.'
    }
  }
  return error instanceof Error && error.message ? error.message : 'Couldn\'t save your graph changes.'
}

/** Mã các node trên chu trình nếu lỗi là 422 CYCLE_DETECTED, ngược lại null. */
export function cycleNodesOf(error: unknown): string[] | null {
  if (isApiError(error) && error.status === 422) return error.cycleNodes ?? []
  return null
}

/**
 * Dùng trong component canvas: `handleError(e)` mở modal chu trình khi 422, còn lại hiện toast.
 * `cycleNodes` và `closeCycleModal` truyền thẳng cho <KahnCycleModal />.
 */
export function useGraphErrorHandler() {
  const showToast = useWorkflowStore((state) => state.ui.showToast)
  const [cycleNodes, setCycleNodes] = useState<string[] | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      const nodes = cycleNodesOf(error)
      if (nodes) {
        // Backend có thể trả cycleNodes rỗng; vẫn mở modal với 1 dòng giải thích để người dùng biết vì sao
        setCycleNodes(nodes.length > 0 ? nodes : ['(the server did not send the task list)'])
        return
      }
      showToast(graphErrorMessage(error), 4000)
    },
    [showToast]
  )

  return { handleError, cycleNodes, closeCycleModal: () => setCycleNodes(null) }
}
