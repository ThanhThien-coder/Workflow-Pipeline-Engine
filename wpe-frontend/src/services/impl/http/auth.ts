import {
  apiRequest,
  setUnauthorizedHandler,
  getStoredToken,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  type UnauthorizedContext,
} from '../../http/apiClient'
import { ApiError, isApiError } from '../../http/ApiError'
import type {
  AuthCredentialsDto,
  AuthResponseDto,
  RegisterUserCommand,
  UserDto,
} from '../../../types/auth.types'

/**
 * A4 — Đăng nhập, đăng ký, đăng xuất bằng /api/v1/auth/* (backend A3) và tự làm mới token khi gặp 401.
 *
 * Lưu phiên: rememberMe = true dùng localStorage, ngược lại sessionStorage.
 * Key: wpe_auth_token, wpe_auth_user (giữ nguyên như trước), wpe_refresh_token (mới).
 */

export const REFRESH_TOKEN_KEY = 'wpe_refresh_token'
/** Key cũ của authSlice (đánh dấu phiên ở localStorage). Vẫn xóa khi đăng xuất cho sạch. */
const STORAGE_TYPE_KEY = 'wpe_auth_storage_type'

/** AuthResponse của backend (A3). */
export interface BackendAuthResponse {
  token: string
  refreshToken: string
  user: {
    id: string
    username: string
    email: string
    name?: string | null
    role: 'USER' | 'ADMIN'
    avatarUrl?: string | null
  }
}

// ───────────────────────── Lưu phiên ─────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư...): coi như không có.
    return fallback
  }
}

/** Storage đang giữ phiên: localStorage nếu có token ở đó, sessionStorage nếu có ở đó, không có thì null. */
function activeStorage(): Storage | null {
  return safe(() => {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) return localStorage
    if (sessionStorage.getItem(AUTH_TOKEN_KEY)) return sessionStorage
    return null
  }, null)
}

export function clearSession(): void {
  safe(() => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(AUTH_TOKEN_KEY)
      storage.removeItem(AUTH_USER_KEY)
      storage.removeItem(REFRESH_TOKEN_KEY)
    }
    localStorage.removeItem(STORAGE_TYPE_KEY)
  }, undefined)
}

export function saveSession(response: AuthResponseDto, rememberMe: boolean): void {
  clearSession()
  safe(() => {
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(AUTH_TOKEN_KEY, response.accessToken)
    storage.setItem(AUTH_USER_KEY, JSON.stringify(response.user))
    if (response.refreshToken) storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
    if (rememberMe) localStorage.setItem(STORAGE_TYPE_KEY, 'local')
  }, undefined)
}

export function getStoredRefreshToken(): string | null {
  return safe(() => activeStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null, null)
}

export function getStoredUser(): UserDto | null {
  return safe(() => {
    const raw = activeStorage()?.getItem(AUTH_USER_KEY)
    return raw ? (JSON.parse(raw) as UserDto) : null
  }, null)
}

// ───────────────────────── Gọi API ─────────────────────────

/** Lấy `exp` trong JWT để điền expiresAt; không đọc được thì coi hạn 15 phút (hạn access token của A3). */
function expiresAtOf(token: string): string {
  const fallback = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  try {
    const payload = token.split('.')[1]
    if (!payload) return fallback
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown }
    return typeof json.exp === 'number' ? new Date(json.exp * 1000).toISOString() : fallback
  } catch {
    return fallback
  }
}

export function toAuthResponseDto(data: BackendAuthResponse): AuthResponseDto {
  return {
    accessToken: data.token,
    refreshToken: data.refreshToken,
    tokenType: 'Bearer',
    expiresAt: expiresAtOf(data.token),
    user: {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      name: data.user.name ?? null,
      systemRole: data.user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      avatarUrl: data.user.avatarUrl ?? null,
    },
  }
}

/**
 * Màn đăng ký không có ô username (không đổi giao diện), nên lấy phần trước @ của email:
 * viết thường, chỉ giữ a-z 0-9 . _ -, tối đa 50 ký tự (backend yêu cầu 3–50).
 */
export function usernameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? ''
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 50)
}

/** POST /auth/login. Backend chỉ tìm theo username nên gửi nguyên chuỗi người dùng nhập. */
export async function login(credentials: AuthCredentialsDto): Promise<AuthResponseDto> {
  const data = await apiRequest<BackendAuthResponse>('POST', '/auth/login', {
    body: {
      username: credentials.identifier.trim(),
      password: credentials.password,
      rememberMe: credentials.rememberMe,
    },
  })
  return toAuthResponseDto(data)
}

/** POST /auth/register → 201 AuthResponse. */
export async function register(cmd: RegisterUserCommand): Promise<AuthResponseDto> {
  const data = await apiRequest<BackendAuthResponse>('POST', '/auth/register', {
    body: {
      username: usernameFromEmail(cmd.email),
      email: cmd.email.trim(),
      password: cmd.password,
      fullName: cmd.fullName.trim(),
    },
  })
  return toAuthResponseDto(data)
}

/**
 * POST /auth/logout kèm refresh token đang lưu (backend thu hồi nó). Không tự xóa phiên:
 * authSlice xóa phiên sau khi gọi, kể cả khi hàm này ném lỗi mạng.
 */
export async function logout(): Promise<void> {
  await apiRequest<unknown>('POST', '/auth/logout', {
    body: { refreshToken: getStoredRefreshToken() },
  })
}

// ───────────────────────── Tự làm mới token ─────────────────────────

/** Không refresh cho chính các request này (refresh hỏng thì lại refresh → vòng lặp; login sai mật khẩu không phải hết hạn). */
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login']

type SessionExpiredListener = () => void
type TokenRefreshedListener = (response: AuthResponseDto) => void

let onSessionExpired: SessionExpiredListener = () => {}
let onTokenRefreshed: TokenRefreshedListener = () => {}

/** Gọi POST /auth/refresh một lần. Thành công: lưu đè token + refresh token mới vào đúng storage đang dùng. */
async function doRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken()
  const storage = activeStorage()
  if (refreshToken && storage) {
    try {
      const data = await apiRequest<BackendAuthResponse>('POST', '/auth/refresh', { body: { refreshToken } })
      // Người dùng đã đăng xuất trong lúc chờ refresh: không ghi lại phiên.
      if (!getStoredToken()) return false
      const response = toAuthResponseDto(data)
      saveSession(response, storage === localStorage)
      onTokenRefreshed(response)
      return true
    } catch {
      // Refresh token sai, đã dùng, hết hạn, tài khoản bị khóa hoặc lỗi mạng: phiên coi như hết.
    }
  }
  clearSession()
  onSessionExpired()
  return false
}

/** Đưa vào apiClient: gặp 401 trên request có token thì refresh rồi cho gửi lại. */
async function handleUnauthorized(ctx: UnauthorizedContext): Promise<boolean> {
  if (NO_REFRESH_PATHS.some((p) => ctx.path.startsWith(p))) return false
  const current = getStoredToken()
  if (!current) return false // Phiên đã bị xóa (đăng xuất, refresh hỏng trước đó)
  if (current !== ctx.token) return true // Lần refresh khác đã xong: chỉ cần gửi lại bằng token mới
  return refreshOnce()
}

/**
 * Single-flight: mọi request cùng bị 401 trong lúc đang refresh dùng chung MỘT promise,
 * nên chỉ có đúng 1 lời gọi /auth/refresh. Backend cho refresh token dùng 1 lần: gọi 2 lần song song
 * thì lần sau bị REFRESH_TOKEN_REUSED và mọi phiên của user bị hủy.
 */
let refreshInFlight: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/**
 * Bật tự làm mới token cho apiClient.
 * - onExpired: refresh thất bại (phiên đã bị xóa khỏi máy) → về màn đăng nhập, báo hết hạn.
 * - onRefreshed: refresh thành công → cập nhật token trong store.
 */
export function installAuthRefresh(onExpired: SessionExpiredListener, onRefreshed?: TokenRefreshedListener): void {
  onSessionExpired = onExpired
  onTokenRefreshed = onRefreshed ?? (() => {})
  setUnauthorizedHandler(handleUnauthorized)
}

// ───────────────────────── Câu báo lỗi ─────────────────────────

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
  USERNAME_TAKEN: 'Tên đăng nhập (phần trước @ của email) đã có người dùng.',
  EMAIL_TAKEN: 'Email này đã được đăng ký.',
}

/** Câu báo lỗi cho màn đăng nhập/đăng ký theo ApiError.code; mã khác thì dùng message của lỗi. */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return AUTH_ERROR_MESSAGES[error.code] ?? (error.message || fallback)
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Lỗi khi gọi getCurrentUser lúc chưa đăng nhập. */
export function notLoggedInError(): ApiError {
  return new ApiError({ status: 401, code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' })
}
