// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflowStore } from '../../useWorkflowStore'
import { MockWorkflowService } from '../../../services/mockWorkflowService'

describe('Auth Module (authSlice)', () => {
  let store: ReturnType<typeof createWorkflowStore>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    store = createWorkflowStore(new MockWorkflowService())
  })

  it('starts with unauthenticated state', () => {
    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(false)
    expect(authState.currentUser).toBeNull()
    expect(authState.token).toBeNull()
    expect(authState.status).toBe('idle')
  })

  it('successfully logs in and saves session in localStorage when rememberMe is true', async () => {
    await store.getState().auth.login({
      identifier: 'alex.kim@pipeline.engine',
      password: 'password123',
      rememberMe: true,
    })

    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(true)
    expect(authState.currentUser).not.toBeNull()
    expect(authState.currentUser?.email).toBe('alex.kim@pipeline.engine')
    expect(authState.token).toBeDefined()

    expect(localStorage.getItem('wpe_auth_token')).toBe(authState.token)
    expect(localStorage.getItem('wpe_auth_storage_type')).toBe('local')
  })

  it('successfully logs in and saves session in sessionStorage when rememberMe is false', async () => {
    await store.getState().auth.login({
      identifier: 'sarah.chen@pipeline.engine',
      password: 'password123',
      rememberMe: false,
    })

    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(true)
    expect(authState.currentUser?.username).toBe('sarah.chen')
    expect(sessionStorage.getItem('wpe_auth_token')).toBe(authState.token)
    expect(localStorage.getItem('wpe_auth_storage_type')).toBeNull()
  })

  it('registers a new user and authenticates immediately', async () => {
    await store.getState().auth.register({
      fullName: 'Marcus Liu',
      email: 'marcus.liu@pipeline.engine',
      password: 'password123',
      workspaceName: 'Acme Systems',
    })

    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(true)
    expect(authState.currentUser?.email).toBe('marcus.liu@pipeline.engine')
    expect(authState.currentUser?.username).toBe('marcus.liu')
  })

  it('hydrates saved session from storage', async () => {
    // Manually simulate a prior saved session
    localStorage.setItem('wpe_auth_token', 'mock-token-xyz')
    localStorage.setItem(
      'wpe_auth_user',
      JSON.stringify({
        id: 1,
        username: 'alex.kim',
        email: 'alex.kim@pipeline.engine',
        systemRole: 'ADMIN',
      }),
    )

    store.getState().auth.hydrate()

    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(true)
    expect(authState.token).toBe('mock-token-xyz')
    expect(authState.currentUser?.username).toBe('alex.kim')
  })

  it('logs out and clears all storage keys', async () => {
    await store.getState().auth.login({
      identifier: 'alex.kim@pipeline.engine',
      password: 'password123',
      rememberMe: true,
    })

    expect(store.getState().auth.isAuthenticated).toBe(true)

    await store.getState().auth.logout()

    const authState = store.getState().auth
    expect(authState.isAuthenticated).toBe(false)
    expect(authState.currentUser).toBeNull()
    expect(authState.token).toBeNull()
    expect(localStorage.getItem('wpe_auth_token')).toBeNull()
    expect(sessionStorage.getItem('wpe_auth_token')).toBeNull()
  })
})
