import { describe, it, expect } from 'vitest'
import { validateDag } from '../kahn'
// Đường dẫn tương đối từ file test này lên gốc repo: __tests__ -> graph -> lib -> src -> wpe-frontend -> gốc.
// Import JSON thẳng (tsconfig đã bật resolveJsonModule), không cần node:fs.
import rawCases from '../../../../../shared/test-fixtures/dag-cases.json'

/**
 * B6 — Bộ case DAG dùng chung với backend
 * (wpe-backend/src/test/java/com/pipeline/wpe/service/engine/dag/DagFixtureCasesTest.java).
 * Cả hai bên đọc cùng shared/test-fixtures/dag-cases.json. Backend là chuẩn: case nào lệch thì sửa FE.
 */

interface DagCase {
  name: string
  nodes: string[]
  edges: [string, string][]
  expectedValid: boolean
  expectedCycleNodes: string[]
}

const CASES = rawCases as DagCase[]

describe('B6: bộ case DAG dùng chung FE/BE (shared/test-fixtures/dag-cases.json)', () => {
  it('đọc được file fixture và có đủ case (ít nhất 15)', () => {
    expect(Array.isArray(CASES)).toBe(true)
    expect(CASES.length).toBeGreaterThanOrEqual(15)
  })

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const res = validateDag(c.nodes, c.edges)

    expect(res.valid).toBe(c.expectedValid)
    // cycleNodes khớp cycleNodeCodes của backend (B1)
    expect(res.cycleNodes).toEqual(c.expectedCycleNodes)
    // violations (mọi node bị chặn) luôn chứa cycleNodes
    expect(res.violations).toEqual(expect.arrayContaining(res.cycleNodes))
  })
})
