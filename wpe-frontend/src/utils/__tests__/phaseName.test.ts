import { describe, expect, it } from 'vitest'
import { phaseDisplayName } from '../phaseName'

describe('phaseDisplayName', () => {
  it('tên thường: hiện tên', () => {
    expect(phaseDisplayName({ name: 'Design', sub: 'UI và UX' })).toBe('Design')
  })

  it('tên tự sinh kiểu cũ "PHASE 3" có phụ đề: hiện phụ đề', () => {
    expect(phaseDisplayName({ name: 'PHASE 3', sub: 'Backend API' })).toBe('Backend API')
    expect(phaseDisplayName({ name: 'phase12', sub: 'QA' })).toBe('QA')
  })

  it('tên kiểu cũ không có phụ đề: vẫn hiện tên', () => {
    expect(phaseDisplayName({ name: 'PHASE 3', sub: '' })).toBe('PHASE 3')
  })

  it('thiếu tên: hiện phụ đề; không có phase: chuỗi rỗng', () => {
    expect(phaseDisplayName({ name: '', sub: 'Only sub' })).toBe('Only sub')
    expect(phaseDisplayName(null)).toBe('')
  })
})
