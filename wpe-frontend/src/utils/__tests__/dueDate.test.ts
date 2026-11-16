import { describe, expect, it } from 'vitest'
import { dateInputToEndOfDayIso, dueDateError, isoToDateInput, minDueDateInput } from '../dueDate'

describe('G21: hạn chót task (utils/dueDate)', () => {
  it('ô ngày -> ISO cuối ngày theo giờ máy, đọc lại ra đúng ngày đó', () => {
    const iso = dateInputToEndOfDayIso('2026-11-20')
    expect(iso).toBe(new Date('2026-11-20T23:59:59').toISOString())
    expect(isoToDateInput(iso)).toBe('2026-11-20')
  })

  it('ngày nhỏ nhất là ngày tạo task (theo giờ máy)', () => {
    const created = new Date('2026-11-16T10:00:00').toISOString()
    expect(minDueDateInput(created)).toBe('2026-11-16')
  })

  it('không biết ngày tạo thì ngày nhỏ nhất là hôm nay', () => {
    expect(minDueDateInput(undefined)).toBe(isoToDateInput(new Date().toISOString()))
  })

  it('cùng ngày tạo hoặc sau đó: hợp lệ; trước ngày tạo: báo lỗi', () => {
    const created = new Date('2026-11-16T10:00:00').toISOString()
    expect(dueDateError('2026-11-16', created)).toBeNull()
    expect(dueDateError('2026-11-30', created)).toBeNull()
    expect(dueDateError('2026-11-15', created)).toContain('2026-11-16')
  })

  it('ô trống (bỏ hạn chót) không báo lỗi', () => {
    expect(dueDateError('', new Date().toISOString())).toBeNull()
  })

  it('ISO rỗng / sai -> chuỗi rỗng', () => {
    expect(isoToDateInput(null)).toBe('')
    expect(isoToDateInput('abc')).toBe('')
  })
})
