/**
 * A2 — Lỗi chuẩn khi gọi backend (khớp ErrorResponse của backend, Chương III integration map).
 *
 * - status: mã HTTP. Lỗi mạng (không tới được backend) thì status = 0.
 * - code: trường `error` của body (ví dụ OPTIMISTIC_LOCK_CONFLICT, CYCLE_DETECTED).
 *   Lỗi mạng thì code = 'NETWORK_ERROR'. Body không có `error` thì code = 'HTTP_<status>'.
 * - message: trường `message` của body, hoặc câu mặc định.
 */
export interface ApiValidationError {
  field: string
  rejectedValue?: unknown
  reason: string
}

export interface ApiErrorInit {
  status: number
  code: string
  message: string
  validationErrors?: ApiValidationError[]
  retryAfterSeconds?: number
  cycleNodes?: string[]
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly validationErrors?: ApiValidationError[]
  readonly retryAfterSeconds?: number
  readonly cycleNodes?: string[]

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.validationErrors = init.validationErrors
    this.retryAfterSeconds = init.retryAfterSeconds
    this.cycleNodes = init.cycleNodes
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
