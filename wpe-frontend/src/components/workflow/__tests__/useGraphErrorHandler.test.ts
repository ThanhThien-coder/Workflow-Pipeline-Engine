import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/http/ApiError'
import { graphErrorMessage } from '../useGraphErrorHandler'

describe('useGraphErrorHandler — graphErrorMessage', () => {
  it('bỏ tiền tố DUE_DATE_LOCKED: và OVERDUE_TASK_LOCKED: khi lưu task hoặc xóa task/phase lỗi', () => {
    const dueErr = new ApiError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'DUE_DATE_LOCKED: Cannot change a due date that has already passed.',
    })
    const overdueErr = new ApiError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'OVERDUE_TASK_LOCKED: Cannot delete an overdue task or phase.',
    })

    expect(graphErrorMessage(dueErr)).toBe('Cannot change a due date that has already passed.')
    expect(graphErrorMessage(overdueErr)).toBe('Cannot delete an overdue task or phase.')
  })

  it('bỏ tiền tố kể cả khi nhận Error thường', () => {
    expect(graphErrorMessage(new Error('OVERDUE_TASK_LOCKED: Phase contains overdue tasks.'))).toBe(
      'Phase contains overdue tasks.',
    )
  })
})
