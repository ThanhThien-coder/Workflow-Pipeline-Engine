import { describe, it, expect } from 'vitest'
import { findNodesOnCycle } from '../scc'
import { validateDag } from '../kahn'

describe('TASK_66: findNodesOnCycle (SCC Tarjan lặp)', () => {
  it('đồ thị rỗng', () => {
    expect(findNodesOnCycle([], {}).size).toBe(0)
  })

  it('1 node không cạnh', () => {
    expect(findNodesOnCycle(['A'], { A: [] }).size).toBe(0)
  })

  it('node tự nối', () => {
    expect([...findNodesOnCycle(['A', 'B'], { A: ['A', 'B'], B: [] })]).toEqual(['A'])
  })

  it('chuỗi không vòng, có cạnh trùng và cạnh tới node lạ', () => {
    expect(findNodesOnCycle(['A', 'B', 'C'], { A: ['B', 'B', 'X'], B: ['C'], C: [] }).size).toBe(0)
  })

  it('chuỗi 10 000 node không tràn stack; đóng vòng thì cả chuỗi trên vòng', () => {
    const n = 10_000
    const vertices = Array.from({ length: n }, (_, i) => `N${i}`)
    const adj: Record<string, string[]> = {}
    vertices.forEach((v, i) => {
      adj[v] = i + 1 < n ? [vertices[i + 1]] : []
    })
    expect(findNodesOnCycle(vertices, adj).size).toBe(0)
    adj[vertices[n - 1]] = [vertices[0]]
    expect(findNodesOnCycle(vertices, adj).size).toBe(n)
  })

  it('validateDag: node giữa 2 vòng không bị báo', () => {
    const res = validateDag(
      ['A', 'B', 'MID', 'D', 'E'],
      [['A', 'B'], ['B', 'A'], ['B', 'MID'], ['MID', 'D'], ['D', 'E'], ['E', 'D']]
    )
    expect(res.cycleNodes).toEqual(['A', 'B', 'D', 'E'])
    expect(res.violations).toContain('MID')
  })
})
