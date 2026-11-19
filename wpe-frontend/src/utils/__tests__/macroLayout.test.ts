import { describe, it, expect } from 'vitest'
import type { MacroPhase } from '../../types/workflow.types'
import { computeNewPhasePosition, MACRO_CARD_H, MACRO_CARD_W, MACRO_GAP_X } from '../macroLayout'
import { columnX } from '../phaseColumnLayout'

function phase(id: string, parentPhaseIds: string[] = [], pos?: { x: number; y: number }): MacroPhase {
  return { id, name: id, sub: '', status: 'TODO', pct: 0, accent: 'slate', w: MACRO_CARD_W, h: MACRO_CARD_H, parentPhaseIds, ...pos }
}

function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < MACRO_CARD_W && Math.abs(a.y - b.y) < MACRO_CARD_H
}

describe('computeNewPhasePosition', () => {
  it('phase con nằm ở cột bên phải phase cha', () => {
    const pos = computeNewPhasePosition([phase('a', [], { x: 40, y: 280 })], 'a')

    expect(pos.x).toBe(40 + MACRO_CARD_W + MACRO_GAP_X)
  })

  it('phase con thứ hai của cùng cha xếp xuống dưới, không nằm ngang và không đè phase con thứ nhất', () => {
    const parent = phase('a', [], { x: 40, y: 280 })
    const first = phase('b', ['a'], computeNewPhasePosition([parent], 'a'))
    const second = computeNewPhasePosition([parent, first], 'a')

    expect(second.x).toBe(first.x)
    expect(second.y).toBeGreaterThan(first.y!)
    expect(overlaps(second, { x: first.x!, y: first.y! })).toBe(false)
  })

  it('phase hiện có chưa lưu vị trí vẫn được tính theo bố cục tự động, phase mới không đè lên', () => {
    const parent = phase('a')
    const unsavedChild = phase('b', ['a'])
    const pos = computeNewPhasePosition([parent, unsavedChild], 'a')

    const displayedChild = computeNewPhasePosition([parent], 'a')
    expect(overlaps(pos, displayedChild)).toBe(false)
  })

  it('phase không có cha xếp xuống dưới ở cột đầu tiên', () => {
    const pos = computeNewPhasePosition([phase('a', [], { x: 40, y: 60 })])

    expect(pos.x).toBe(40)
    expect(pos.y).toBeGreaterThanOrEqual(60 + MACRO_CARD_H)
  })

  it('TASK_72: cột đích đã có thẻ ở trên cha thì phase mới không cao hơn cha và không đè', () => {
    const parent = phase('a', [], { x: 40, y: 500 })
    const above = phase('b', ['a'], { x: 510, y: 60 }) // đã ở cột 1, cao hơn cha (sẽ bị đưa về ngang cha)
    const pos = computeNewPhasePosition([parent, above], 'a')

    expect(pos.x).toBe(columnX(1))
    expect(pos.y).toBeGreaterThanOrEqual(500)
    // b hiển thị ngang cha (y=500); phase mới phải nằm dưới nó
    expect(pos.y).toBeGreaterThanOrEqual(500 + MACRO_CARD_H)
  })

  it('TASK_72: ô trống đầu tiên từ y cha trở xuống, dùng cột của cha chứ không dùng x đã lưu', () => {
    const root = phase('a', [], { x: 999, y: 100 }) // x lưu sai, vẫn là cột 0
    const mid = phase('b', ['a'], { x: 40, y: 100 }) // x lưu sai, thực tế cột 1
    const pos = computeNewPhasePosition([root, mid], 'b')

    expect(pos.x).toBe(columnX(2))
    expect(pos.y).toBeGreaterThanOrEqual(100)
  })
})