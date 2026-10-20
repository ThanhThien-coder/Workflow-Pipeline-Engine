// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { buildGuestUrl } from '../guestUrl'
import { guestAccessStore } from '../../services/mock/guestAccessStore'

describe('guestUrl utils', () => {
  it('builds guest url using window.location.origin and retains full token', () => {
    const token = 'gst_sec_89f2a4'
    const url = buildGuestUrl(token)
    expect(url).toContain('/guest?token=gst_sec_89f2a4')
    expect(url).not.toContain('pipeline.io')
    expect(url.startsWith(window.location.origin)).toBe(true)
  })

  it('encodes special characters in token', () => {
    const token = 'gst_test+special&value'
    const url = buildGuestUrl(token)
    expect(url).toContain('gst_test%2Bspecial%26value')
  })
})

describe('guestAccessStore', () => {
  beforeEach(() => {
    guestAccessStore.clear()
  })

  it('stores and retrieves token status', () => {
    expect(guestAccessStore.get('gst_1')).toBeUndefined()
    guestAccessStore.set('gst_1', 'active')
    expect(guestAccessStore.get('gst_1')).toBe('active')
    guestAccessStore.set('gst_1', 'revoked')
    expect(guestAccessStore.get('gst_1')).toBe('revoked')
  })

  it('clears all token statuses', () => {
    guestAccessStore.set('gst_1', 'active')
    guestAccessStore.set('gst_2', 'revoked')
    guestAccessStore.clear()
    expect(guestAccessStore.get('gst_1')).toBeUndefined()
    expect(guestAccessStore.get('gst_2')).toBeUndefined()
  })
})
