import { describe, expect, it } from 'vitest'
import { notificationLines } from '../notificationLines'
import { mapBackendNotification } from '../../services/impl/HttpNotificationService'

describe('notificationLines', () => {
  it('thông báo góp ý: dòng chính là tiêu đề, dòng phụ là lời góp ý', () => {
    const n = mapBackendNotification({
      id: 1,
      title: 'New feedback from Dr. Tran on WPE-005',
      message: 'Please add the sequence diagram.',
      linkUrl: '/project/5/overview',
      isRead: false,
      createdAt: '2026-11-21T03:00:00Z',
    })
    expect(n.kind).toBe('comment')
    expect(notificationLines(n)).toEqual({
      headline: 'New feedback from Dr. Tran on WPE-005',
      detail: 'Please add the sequence diagram.',
    })
  })

  it('phạm vi góp ý có chữ "review" vẫn là góp ý, không thành approval', () => {
    const n = mapBackendNotification({ id: 2, title: 'New feedback from Anonymous on Phase 3 · Review', message: 'x' })
    expect(n.kind).toBe('comment')
  })

  it('không có nội dung riêng (message trùng tiêu đề) thì không lặp dòng phụ', () => {
    const n = mapBackendNotification({ id: 3, title: 'Task WPE-1 is overdue', message: null })
    expect(notificationLines(n)).toEqual({ headline: 'Task WPE-1 is overdue', detail: null })
  })

  it('thông báo mock chỉ có text: giữ một dòng như cũ', () => {
    expect(notificationLines({ text: 'approved schema for WPE-009' })).toEqual({
      headline: 'approved schema for WPE-009',
      detail: null,
    })
  })
})
