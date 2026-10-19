import type {
  AuthCredentialsDto,
  RegisterUserCommand,
  UserDto,
} from '../../types/auth.types'
import { workflowService } from '../../services/container'

const TOKEN_KEY = 'wpe_auth_token'
const USER_KEY = 'wpe_auth_user'
const STORAGE_TYPE_KEY = 'wpe_auth_storage_type'

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

function clearStorage(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(STORAGE_TYPE_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function saveAuthSession(token: string, user: UserDto, rememberMe: boolean): void {
  clearStorage()
  try {
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(TOKEN_KEY, token)
    storage.setItem(USER_KEY, JSON.stringify(user))
    if (rememberMe) {
      localStorage.setItem(STORAGE_TYPE_KEY, 'local')
    }
  } catch {
    // Ignore storage quota or permission errors
  }
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
        saveAuthSession(response.accessToken, response.user, credentials.rememberMe)

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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed'
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
        saveAuthSession(response.accessToken, response.user, true)

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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed'
        set((state) => ({
          auth: { ...state.auth, status: 'idle', error: message },
        }))
        throw err
      }
    },

    logout: async () => {
      clearStorage()
      try {
        await workflowService.logout()
      } catch {
        // Ignore logout errors
      }

      set((state) => ({
        auth: {
          ...state.auth,
          currentUser: null,
          token: null,
          isAuthenticated: false,
          status: 'idle',
          error: null,
        },
      }))
    },
  },
}
}
