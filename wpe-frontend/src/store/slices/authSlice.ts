import type {
  AuthCredentialsDto,
  AuthResponseDto,
  RegisterUserCommand,
  UserDto,
} from '../../types/auth.types'
import { workflowService } from '../../services/container'
import {
  clearSession,
  saveSession,
  installAuthRefresh,
  getAuthErrorMessage,
} from '../../services/impl/http/auth'
import { useProfileStore } from '../useProfileStore'
import { useNotificationStore } from '../useNotificationStore'
import { createOverviewSlice } from './overviewSlice'
import { createKanbanSlice } from './kanbanSlice'
import { createSettingsSlice } from './settingsSlice'
import { createDevSlice } from './devSlice'
import { createWorkspaceSlice } from './workspaceSlice'
import { createArtifactsSlice } from './artifactsSlice'

const TOKEN_KEY = 'wpe_auth_token'
const USER_KEY = 'wpe_auth_user'
const AVATAR_KEY = 'wpe_user_avatar'

export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn'

export interface AuthState {
  currentUser: UserDto | null
  token: string | null
  isAuthenticated: boolean
  status: 'idle' | 'loading'
  error: string | null
}

export interface AuthSlice {
  auth: AuthState & {
    login: (credentials: AuthCredentialsDto) => Promise<void>
    register: (cmd: RegisterUserCommand) => Promise<void>
    logout: () => Promise<void>
    hydrate: () => void
    syncUserAvatar: (avatarUrl: string | null) => void
  }
}

type AuthSetter = (
  partial: Record<string, unknown> | ((state: any) => Record<string, unknown>),
) => void

/** A4: xóa toàn bộ phiên trên máy (token, user, refresh token ở cả 2 storage) và avatar của người cũ. */
function clearStorage(): void {
  clearSession()
  try {
    localStorage.removeItem(AVATAR_KEY)
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * A4: dọn dữ liệu của người vừa đăng xuất để người đăng nhập sau không thấy.
 * Tạo lại các slice của useWorkflowStore (trừ auth và ui: toast "hết hạn" vẫn phải hiện),
 * trả các trường gốc về giá trị ban đầu (giống useWorkflowStore.ts), và dọn useProfileStore, useNotificationStore.
 */
function resetUserData(set: AuthSetter, get: () => any): void {
  const anySet = set as any
  set({
    ...createOverviewSlice(anySet, get),
    ...createKanbanSlice(anySet, get),
    ...createSettingsSlice(anySet, get),
    ...createDevSlice(anySet, get),
    ...createWorkspaceSlice(anySet, get),
    ...createArtifactsSlice(anySet, get),
    activeTab: 'workflow',
    currentProjectId: null,
    macroPhases: [],
    workflowEdges: [],
    selectedPhaseId: null,
    trees: {},
  })
  useProfileStore.setState({ profile: null, loading: false, error: null })
  useNotificationStore.setState({ items: [], unreadCount: 0, loading: false, error: false })
}

const LOGGED_OUT: AuthState = {
  currentUser: null,
  token: null,
  isAuthenticated: false,
  status: 'idle',
  error: null,
}

function loadAuthSession(): { token: string; user: UserDto } | null {
  try {
    // Try localStorage first
    let token = localStorage.getItem(TOKEN_KEY)
    let userJson = localStorage.getItem(USER_KEY)

    // Fallback to sessionStorage
    if (!token) {
      token = sessionStorage.getItem(TOKEN_KEY)
      userJson = sessionStorage.getItem(USER_KEY)
    }

    if (token && userJson) {
      const user = JSON.parse(userJson) as UserDto
      return { token, user }
    }
  } catch {
    return null
  }
  return null
}

export const createAuthSlice = (set: AuthSetter, get: () => AuthSlice): AuthSlice => {
  const initialSession = loadAuthSession()

  const applySession = (response: AuthResponseDto, rememberMe: boolean) => {
    saveSession(response, rememberMe)
    set((state: any) => ({
      auth: {
        ...state.auth,
        currentUser: response.user,
        token: response.accessToken,
        isAuthenticated: true,
        status: 'idle',
        error: null,
      },
      ...(state.kanban ? { kanban: { ...state.kanban, currentUserId: response.user.id } } : {}),
    }))
  }

  const signOutLocally = () => {
    clearStorage()
    resetUserData(set, get)
    set((state: any) => ({ auth: { ...state.auth, ...LOGGED_OUT } }))
  }

  // A4: gặp 401 trên request có token thì apiClient tự refresh (single-flight, xem impl/http/auth.ts).
  installAuthRefresh(
    () => {
      // Refresh thất bại: xóa phiên, dọn dữ liệu, App.tsx thấy isAuthenticated = false sẽ đưa về /auth.
      signOutLocally()
      ;(get() as any).ui?.showToast?.(SESSION_EXPIRED_MESSAGE)
    },
    (response) => {
      set((state: any) => ({ auth: { ...state.auth, token: response.accessToken, currentUser: response.user } }))
    },
  )

  return {
    auth: {
      currentUser: initialSession?.user ?? null,
      token: initialSession?.token ?? null,
      isAuthenticated: Boolean(initialSession?.token),
      status: 'idle',
      error: null,

    hydrate: () => {
      const session = loadAuthSession()
      if (session) {
        set((state) => ({
          auth: {
            ...state.auth,
            token: session.token,
            currentUser: session.user,
            isAuthenticated: true,
            status: 'idle',
            error: null,
          },
        }))
      }
    },
    syncUserAvatar: (avatarUrl: string | null) => {
      set((state: any) => {
        const nextAuth = state.auth
          ? {
              ...state.auth,
              currentUser: state.auth.currentUser
                ? {
                    ...state.auth.currentUser,
                    avatarUrl,
                  }
                : null,
            }
          : undefined

        const nextSettings = state.settings
          ? {
              ...state.settings,
              members: (state.settings.members || []).map((m: any) => {
                if (
                  m.username === 'Sarah Chen' ||
                  m.userId === '2' ||
                  m.username === state.auth?.currentUser?.username ||
                  m.userId === state.auth?.currentUser?.id
                ) {
                  return { ...m, avatarUrl }
                }
                return m
              }),
            }
          : undefined

        const nextKanban = state.kanban
          ? {
              ...state.kanban,
              members: (state.kanban.members || []).map((m: any) => {
                if (
                  m.name === 'Sarah Chen' ||
                  m.id === '2' ||
                  m.name === state.auth?.currentUser?.username ||
                  m.id === state.auth?.currentUser?.id
                ) {
                  return { ...m, avatarUrl }
                }
                return m
              }),
            }
          : undefined

        return {
          ...(nextAuth ? { auth: nextAuth } : {}),
          ...(nextSettings ? { settings: nextSettings } : {}),
          ...(nextKanban ? { kanban: nextKanban } : {}),
        }
      })
      try {
        const current = localStorage.getItem(USER_KEY)
        if (current) {
          const user = JSON.parse(current) as UserDto
          localStorage.setItem(USER_KEY, JSON.stringify({ ...user, avatarUrl }))
        }
        if (avatarUrl) {
          localStorage.setItem('wpe_user_avatar', avatarUrl)
        } else {
          localStorage.removeItem('wpe_user_avatar')
        }
      } catch {
        // Ignore storage errors
      }
    },

    login: async (credentials: AuthCredentialsDto) => {
      set((state) => ({
        auth: { ...state.auth, status: 'loading', error: null },
      }))

      try {
        const response = await workflowService.login(credentials)
        applySession(response, credentials.rememberMe)
      } catch (err) {
        const message = getAuthErrorMessage(err, 'Login failed')
        set((state) => ({
          auth: { ...state.auth, status: 'idle', error: message },
        }))
        throw err
      }
    },

    register: async (cmd: RegisterUserCommand) => {
      set((state) => ({
        auth: { ...state.auth, status: 'loading', error: null },
      }))

      try {
        const response = await workflowService.register(cmd)
        applySession(response, true)
      } catch (err) {
        const message = getAuthErrorMessage(err, 'Registration failed')
        set((state) => ({
          auth: { ...state.auth, status: 'idle', error: message },
        }))
        throw err
      }
    },

    logout: async () => {
      // Gọi /auth/logout TRƯỚC khi xóa phiên: backend cần refresh token đang lưu để thu hồi.
      try {
        await workflowService.logout()
      } catch {
        // Lỗi mạng hoặc backend lỗi: vẫn xóa phiên trên máy.
      }
      signOutLocally()
    },
  },
}
}
