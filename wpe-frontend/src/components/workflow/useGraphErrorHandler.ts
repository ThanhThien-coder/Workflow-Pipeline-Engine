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
        return 'Dự án đã được lưu trữ, chỉ xem được, không sửa được đồ thị.'
      case 'NETWORK_ERROR':
        return 'Mất kết nối máy chủ. Thay đổi chưa được lưu.'
      case 'CYCLE_DETECTED':
        return 'Không thể nối: tạo chu trình lặp phụ thuộc.'
      default:
        return error.message || 'Không lưu được thay đổi đồ thị.'
    }
  }
  return error instanceof Error && error.message ? error.message : 'Không lưu được thay đổi đồ thị.'
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
        setCycleNodes(nodes.length > 0 ? nodes : ['(máy chủ không gửi danh sách node)'])
        return
      }
      showToast(graphErrorMessage(error), 4000)
    },
    [showToast]
  )

  return { handleError, cycleNodes, closeCycleModal: () => setCycleNodes(null) }
}
