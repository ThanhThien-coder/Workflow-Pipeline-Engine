import { describe, expect, it } from 'vitest'
import { computeFitTransform, MAX_SCALE, MIN_SCALE } from '../usePanZoom'

describe('computeFitTransform', () => {
  it('đồ thị lớn hơn khung: thu nhỏ để vừa và căn giữa', () => {
    const { scale, pan } = computeFitTransform(
      { minX: 0, minY: 0, maxX: 2000, maxY: 1000 },
      { width: 1096, height: 596 },
      { padding: 48 }
    )
    // khung còn 1000 x 500 sau khi chừa 48px mỗi bên → scale = min(1000/2000, 500/1000) = 0.5
    expect(scale).toBeCloseTo(0.5)
    // nội dung 1000 x 500 trên màn hình, căn giữa khung 1096 x 596
    expect(pan.x).toBeCloseTo(48)
    expect(pan.y).toBeCloseTo(48)
  })

  it('đồ thị nhỏ: không phóng quá maxScale (mặc định 100%), vẫn căn giữa', () => {
    const { scale, pan } = computeFitTransform({ minX: 100, minY: 50, maxX: 300, maxY: 150 }, { width: 800, height: 600 })
    expect(scale).toBe(1)
    expect(pan.x).toBeCloseTo((800 - 200) / 2 - 100)
    expect(pan.y).toBeCloseTo((600 - 100) / 2 - 50)
  })

  it('trừ phần lệch của lớp nội dung (margin)', () => {
    const base = computeFitTransform({ minX: 0, minY: 0, maxX: 400, maxY: 200 }, { width: 800, height: 600 })
    const shifted = computeFitTransform({ minX: 0, minY: 0, maxX: 400, maxY: 200 }, { width: 800, height: 600 }, { contentOffset: { x: 20, y: 20 } })
    expect(shifted.pan.x).toBeCloseTo(base.pan.x - 20)
    expect(shifted.pan.y).toBeCloseTo(base.pan.y - 20)
  })

  it('đồ thị rất lớn: zoom không nhỏ hơn MIN_SCALE; không lớn hơn MAX_SCALE', () => {
    expect(computeFitTransform({ minX: 0, minY: 0, maxX: 100000, maxY: 100000 }, { width: 800, height: 600 }).scale).toBe(MIN_SCALE)
    expect(computeFitTransform({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { width: 800, height: 600 }, { maxScale: 5 }).scale).toBe(MAX_SCALE)
  })
})
