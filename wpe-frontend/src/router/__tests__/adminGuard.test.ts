import { describe, expect, it } from 'vitest'
import {
  resolveAdminAccess,
  homePathFor,
  ADMIN_ONLY_MESSAGE,
} from '../adminGuard'

describe('adminGuard', () => {
  describe('resolveAdminAccess', () => {
    it('chưa đăng nhập (isAuthenticated = false) -> TO_SIGNIN', () => {
      expect(resolveAdminAccess(false, undefined)).toBe('TO_SIGNIN')
      expect(resolveAdminAccess(false, null)).toBe('TO_SIGNIN')
      expect(resolveAdminAccess(false, 'USER')).toBe('TO_SIGNIN')
      expect(resolveAdminAccess(false, 'ADMIN')).toBe('TO_SIGNIN')
    })

    it('đã đăng nhập nhưng role không phải ADMIN (USER hoặc không có role) -> TO_WORKSPACES', () => {
      expect(resolveAdminAccess(true, 'USER')).toBe('TO_WORKSPACES')
      expect(resolveAdminAccess(true, undefined)).toBe('TO_WORKSPACES')
      expect(resolveAdminAccess(true, null)).toBe('TO_WORKSPACES')
    })

    it('đã đăng nhập và role là ADMIN -> ALLOW', () => {
      expect(resolveAdminAccess(true, 'ADMIN')).toBe('ALLOW')
    })
  })

  describe('homePathFor', () => {
    it('role ADMIN -> /admin', () => {
      expect(homePathFor('ADMIN')).toBe('/admin')
    })

    it('role khác ADMIN (USER, undefined, null) -> /workspaces', () => {
      expect(homePathFor('USER')).toBe('/workspaces')
      expect(homePathFor(undefined)).toBe('/workspaces')
      expect(homePathFor(null)).toBe('/workspaces')
    })
  })

  describe('ADMIN_ONLY_MESSAGE', () => {
    it('đúng thông báo chặn user thường', () => {
      expect(ADMIN_ONLY_MESSAGE).toBe('Chỉ quản trị viên mới vào được trang này')
    })
  })
})
