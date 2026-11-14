export type AdminGuardResult = 'ALLOW' | 'TO_SIGNIN' | 'TO_WORKSPACES'

export const ADMIN_ONLY_MESSAGE = 'Chỉ quản trị viên mới vào được trang này'

export function resolveAdminAccess(
  isAuthenticated: boolean,
  systemRole: 'ADMIN' | 'USER' | undefined | null
): AdminGuardResult {
  if (!isAuthenticated) {
    return 'TO_SIGNIN'
  }
  if (systemRole !== 'ADMIN') {
    return 'TO_WORKSPACES'
  }
  return 'ALLOW'
}

export function homePathFor(
  systemRole: 'ADMIN' | 'USER' | undefined | null
): '/admin' | '/workspaces' {
  if (systemRole === 'ADMIN') {
    return '/admin'
  }
  return '/workspaces'
}
