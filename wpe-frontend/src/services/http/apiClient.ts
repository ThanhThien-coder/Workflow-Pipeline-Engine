import { ApiError, NETWORK_ERROR_CODE, type ApiValidationError } from './ApiError'

/**
 * A2 — Lớp gọi HTTP dùng chung cho mọi service gọi backend thật.
 *
 * - Base URL chuẩn: VITE_API_BASE_URL, mặc định http://localhost:8080/api/v1.
 * - Có token (wpe_auth_token trong localStorage hoặc sessionStorage) thì gửi Authorization: Bearer.
 * - Không có token mà đang dev thì gửi X-Debug-User-Id lấy từ `id` của wpe_auth_user (nếu có).
 * - Lỗi HTTP ném ApiError(status, code, message, ...). Lỗi mạng ném ApiError(status 0, NETWORK_ERROR).
 * - 204 (hoặc body rỗng) trả undefined.
 * - setUnauthorizedHandler: chỗ để A4 gắn phần tự làm mới token khi gặp 401.
 */

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export const AUTH_TOKEN_KEY = 'wpe_auth_token'
export const AUTH_USER_KEY = 'wpe_auth_user'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | null | undefined

export interface ApiRequestOptions {
  body?: unknown
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface UnauthorizedContext {
  error: ApiError
  method: HttpMethod
  path: string
  /**
   * A4: access token đã gửi kèm request bị 401. Handler so với token đang lưu:
   * khác nhau nghĩa là đã có lần refresh khác xong rồi, chỉ cần gửi lại, không refresh nữa.
   */
  token: string
}

/**
 * Được gọi khi request CÓ GỬI token mà backend trả 401.
 * Trả true nếu đã làm mới token xong: apiClient gửi lại request gốc đúng 1 lần (đọc token mới).
 * Trả false (hoặc ném lỗi): apiClient ném ApiError 401 ban đầu.
 */
export type UnauthorizedHandler = (ctx: UnauthorizedContext) => Promise<boolean> | boolean

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(key)
      if (value) return value
    }
    if (typeof sessionStorage !== 'undefined') {
      const value = sessionStorage.getItem(key)
      if (value) return value
    }
  } catch {
    // Trình duyệt chặn storage: coi như chưa đăng nhập.
  }
  return null
}

export function getStoredToken(): string | null {
  return readStorage(AUTH_TOKEN_KEY)
}

export function getStoredUserId(): string | null {
  const raw = readStorage(AUTH_USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { id?: unknown }
    return parsed && parsed.id != null ? String(parsed.id) : null
  } catch {
    return null
  }
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  let url = `${API_BASE_URL}${normalizedPath}`
  if (query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      params.append(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`
  }
  return url
}

function buildHeaders(options: ApiRequestOptions, token: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else if (import.meta.env.DEV) {
    const debugUserId = getStoredUserId()
    if (debugUserId) headers['X-Debug-User-Id'] = debugUserId
  }
  return { ...headers, ...(options.headers ?? {}) }
}

function parseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '')
  const body = parseBody(text)
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  const code = typeof data.error === 'string' && data.error ? data.error : `HTTP_${res.status}`
  const message =
    typeof data.message === 'string' && data.message ? data.message : `Yêu cầu thất bại (HTTP ${res.status})`

  return new ApiError({
    status: res.status,
    code,
    message,
    validationErrors: Array.isArray(data.validationErrors)
      ? (data.validationErrors as ApiValidationError[])
      : undefined,
    retryAfterSeconds: toNumber(data.retryAfterSeconds) ?? toNumber(res.headers.get('Retry-After')),
    cycleNodes: Array.isArray(data.cycleNodes) ? (data.cycleNodes as unknown[]).map(String) : undefined,
  })
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'
}

async function send(method: HttpMethod, path: string, options: ApiRequestOptions): Promise<{ res: Response; sentToken: string | null }> {
  const token = getStoredToken()
  const init: RequestInit = {
    method,
    headers: buildHeaders(options, token),
    signal: options.signal,
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  try {
    const res = await fetch(buildUrl(path, options.query), init)
    return { res, sentToken: token }
  } catch (error) {
    // Hủy request chủ động (AbortController) không phải lỗi mạng: ném nguyên lỗi gốc.
    if (isAbortError(error)) throw error
    throw new ApiError({
      status: 0,
      code: NETWORK_ERROR_CODE,
      message: 'Không kết nối được tới máy chủ. Vui lòng kiểm tra backend hoặc mạng.',
    })
  }
}

export async function apiRequest<T>(method: HttpMethod, path: string, options: ApiRequestOptions = {}): Promise<T> {
  let { res, sentToken } = await send(method, path, options)

  if (res.status === 401 && sentToken && unauthorizedHandler) {
    const error = await toApiError(res)
    let refreshed = false
    try {
      refreshed = await unauthorizedHandler({ error, method, path, token: sentToken })
    } catch {
      refreshed = false
    }
    if (!refreshed) throw error
    ;({ res } = await send(method, path, options))
  }

  if (!res.ok) {
    throw await toApiError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  return parseBody(text) as T
}
