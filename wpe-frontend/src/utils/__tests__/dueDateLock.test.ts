import { describe, expect, it } from 'vitest'
import { ApiError } from '../../services/http/ApiError'
import {
  DUE_DATE_PASSED_LOCK_TITLE,
  TASK_DONE_LOCK_TITLE,
  dueDateLockReason,
  friendlyLockMessage,
  isDueDateLocked,
} from '../dueDateLock'

describe('utils/dueDateLock', () => {
  const vnNoonNov21 = new Date('2026-11-21T05:00:00.000Z') // 12:00 VN on 2026-11-21

  describe('isDueDateLocked & dueDateLockReason', () => {
    it('trả false khi task chưa DONE không có hạn; trả true với title DONE khi task DONE không có hạn', () => {
      expect(isDueDateLocked(null, vnNoonNov21)).toBe(false)
      expect(isDueDateLocked(undefined, vnNoonNov21)).toBe(false)
      expect(isDueDateLocked({ status: 'TODO', due: null }, vnNoonNov21)).toBe(false)
      expect(isDueDateLocked({ status: 'TODO', dueDate: '' }, vnNoonNov21)).toBe(false)
      expect(isDueDateLocked({ status: 'DONE', due: null }, vnNoonNov21)).toBe(true)
      expect(isDueDateLocked({ status: 'DONE', dueDate: '' }, vnNoonNov21)).toBe(true)
      expect(dueDateLockReason({ status: 'DONE', due: null }, vnNoonNov21)).toBe(
        TASK_DONE_LOCK_TITLE,
      )
      expect(dueDateLockReason({ status: 'DONE', dueDate: '' }, vnNoonNov21)).toBe(
        TASK_DONE_LOCK_TITLE,
      )
    })

    it('trả true với title DONE khi task DONE có hạn (dù hạn chưa qua hay đã qua)', () => {
      expect(isDueDateLocked({ status: 'DONE', due: '2026-11-30' }, vnNoonNov21)).toBe(true)
      expect(dueDateLockReason({ status: 'DONE', due: '2026-11-30' }, vnNoonNov21)).toBe(
        TASK_DONE_LOCK_TITLE,
      )
      expect(
        dueDateLockReason({ status: 'DONE', dueDate: '2026-11-10T23:59:59+07:00' }, vnNoonNov21),
      ).toBe(TASK_DONE_LOCK_TITLE)
    })

    it('trả false khi hạn là hôm nay hoặc tương lai theo ngày Việt Nam (task chưa DONE)', () => {
      expect(isDueDateLocked({ status: 'TODO', due: '2026-11-21' }, vnNoonNov21)).toBe(false)
      expect(
        isDueDateLocked({ status: 'IN_PROGRESS', dueDate: '2026-11-21T23:59:59+07:00' }, vnNoonNov21),
      ).toBe(false)
      expect(isDueDateLocked({ status: 'REVIEW', due: '2026-11-25' }, vnNoonNov21)).toBe(false)
      expect(dueDateLockReason({ status: 'TODO', due: '2026-11-21' }, vnNoonNov21)).toBeNull()
    })

    it('trả true với title quá hạn khi hạn đã qua theo ngày Việt Nam', () => {
      expect(isDueDateLocked({ status: 'TODO', due: '2026-11-20' }, vnNoonNov21)).toBe(true)
      expect(dueDateLockReason({ status: 'TODO', due: '2026-11-20' }, vnNoonNov21)).toBe(
        DUE_DATE_PASSED_LOCK_TITLE,
      )
      expect(
        dueDateLockReason(
          { status: 'IN_PROGRESS', dueDate: '2026-11-20T16:59:59.000Z' },
          vnNoonNov21,
        ),
      ).toBe(DUE_DATE_PASSED_LOCK_TITLE)
    })

    it('so đúng ranh giới 00:00 giờ Việt Nam (UTC+7)', () => {
      // 16:59:59 UTC = 23:59:59 VN ngày 2026-11-20 -> hạn 2026-11-20 chưa qua
      const beforeVnMidnight = new Date('2026-11-20T16:59:59.000Z')
      expect(isDueDateLocked({ status: 'TODO', due: '2026-11-20' }, beforeVnMidnight)).toBe(false)

      // 17:00:00 UTC = 00:00:00 VN ngày 2026-11-21 -> hạn 2026-11-20 đã qua
      const atVnMidnight = new Date('2026-11-20T17:00:00.000Z')
      expect(isDueDateLocked({ status: 'TODO', due: '2026-11-20' }, atVnMidnight)).toBe(true)

      // dueDate dạng ISO ở 17:00 UTC ngày 20 (tức 00:00 VN ngày 21) -> ở ngày 21 VN chưa quá hạn
      expect(
        isDueDateLocked({ status: 'TODO', dueDate: '2026-11-20T17:00:00.000Z' }, atVnMidnight),
      ).toBe(false)
    })

    it('bỏ qua chuỗi ngày sai định dạng', () => {
      expect(isDueDateLocked({ status: 'TODO', due: 'not-a-date' }, vnNoonNov21)).toBe(false)
    })
  })

  describe('friendlyLockMessage', () => {
    it('bỏ tiền tố DUE_DATE_LOCKED: và OVERDUE_TASK_LOCKED:', () => {
      expect(friendlyLockMessage('DUE_DATE_LOCKED: Past due date cannot be changed.')).toBe(
        'Past due date cannot be changed.',
      )
      expect(
        friendlyLockMessage(
          new ApiError({
            status: 400,
            code: 'BAD_REQUEST',
            message: 'OVERDUE_TASK_LOCKED: Cannot delete an overdue task.',
          }),
        ),
      ).toBe('Cannot delete an overdue task.')
      expect(friendlyLockMessage(new Error('DUE_DATE_LOCKED:Task is done.'))).toBe('Task is done.')
    })

    it('giữ nguyên thông báo không có tiền tố và trả chuỗi rỗng khi lỗi rỗng', () => {
      expect(friendlyLockMessage('Something else went wrong')).toBe('Something else went wrong')
      expect(friendlyLockMessage(new Error('Network error'))).toBe('Network error')
      expect(friendlyLockMessage(null)).toBe('')
      expect(friendlyLockMessage(undefined)).toBe('')
    })
  })
})
