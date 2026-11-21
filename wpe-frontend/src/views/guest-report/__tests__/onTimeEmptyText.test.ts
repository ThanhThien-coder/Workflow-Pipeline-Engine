import { describe, it, expect } from 'vitest'
import { onTimeEmptyText } from '../sections/helpers'

describe('onTimeEmptyText — câu ở thẻ On time khi chưa tính được %', () => {
  it('chưa có task', () => {
    expect(onTimeEmptyText([])).toBe('No tasks yet')
  })

  it('có task đang làm nhưng chưa task nào có hạn chót: nói rõ là thiếu hạn chót', () => {
    expect(onTimeEmptyText([{ due: null }, { due: null }])).toBe(
      'No task has a due date yet, so nothing is on time or late',
    )
  })

  it('có hạn chót nhưng chưa tới hạn', () => {
    expect(onTimeEmptyText([{ due: null }, { due: new Date('2026-12-01T00:00:00Z') }])).toBe(
      'No task has reached its due date yet',
    )
  })
})
