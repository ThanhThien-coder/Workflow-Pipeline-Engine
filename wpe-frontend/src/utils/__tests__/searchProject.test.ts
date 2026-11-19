import { describe, it, expect } from 'vitest'
import { searchProject, normalizeText, MAX_SEARCH_RESULTS } from '../searchProject'
import type { BranchGraphNode, GraphNodeMap, MacroPhase } from '../../types/workflow.types'
import type { UserSummary } from '../../types/kanban.types'

const phase = (id: string, name: string): MacroPhase => ({
  id, name, sub: '', status: 'TODO', pct: 0, accent: 'blue', w: 200, h: 100, parentPhaseIds: [],
})

const task = (id: string, code: string, title: string, assignee: string | null = null, isTrack = false): BranchGraphNode => ({
  kind: 'branch', id, code, title, isTrack, status: 'TODO', parentIds: [], description: '',
  assignee, due: null, blocker: null, joinPolicy: null,
})

const tree = (...nodes: BranchGraphNode[]): GraphNodeMap => Object.fromEntries(nodes.map((n) => [n.id, n]))

const members: UserSummary[] = [
  { id: 'u1', name: 'Nguyễn Thiện', roleTitle: '', initials: 'NT', avatarClass: '', projectRole: 'OWNER', assignedTaskCount: 0 },
]

const source = {
  macroPhases: [phase('p1', 'Thiết kế'), phase('p2', 'Build')],
  trees: {
    p1: tree(task('t1', 'WPE-1', 'Thiết kế database', 'u1'), task('t2', 'WPE-10', 'Vẽ wireframe')),
    p2: tree(task('t3', 'WPE-100', 'Cài CI'), task('trk', 'TRK-1', 'Thiết kế track', null, true)),
  },
  members,
}

describe('normalizeText', () => {
  it('bỏ dấu tiếng Việt, đ thành d, hạ chữ thường', () => {
    expect(normalizeText('  Thiết  Kế Đẹp ')).toBe('thiet ke dep')
  })
})

describe('searchProject', () => {
  it('chuỗi rỗng trả về mảng rỗng', () => {
    expect(searchProject('   ', source)).toEqual([])
  })

  it('gõ "thiet ke" (không dấu) tìm ra phase và task "Thiết kế"', () => {
    const results = searchProject('thiet ke', source)
    expect(results.some((r) => r.kind === 'phase' && r.name === 'Thiết kế')).toBe(true)
    expect(results.some((r) => r.kind === 'task' && r.id === 't1')).toBe(true)
  })

  it('không trả task dạng track', () => {
    expect(searchProject('track', source).find((r) => r.id === 'trk')).toBeUndefined()
  })

  it('xếp hạng: mã khớp hệt > mã bắt đầu bằng', () => {
    const ids = searchProject('wpe-1', source).filter((r) => r.kind === 'task').map((r) => r.id)
    expect(ids).toEqual(['t1', 't2', 't3'])
  })

  it('xếp hạng: bắt đầu bằng > chứa', () => {
    const s = {
      macroPhases: [phase('p1', 'X')],
      trees: { p1: tree(task('a', 'A-1', 'Cài đặt db'), task('b', 'B-1', 'db migration')) },
      members: [],
    }
    expect(searchProject('db', s).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('tìm theo tên người làm và trả tên người làm, tên phase', () => {
    const [first] = searchProject('thien', source).filter((r) => r.kind === 'task')
    expect(first).toMatchObject({ id: 't1', assigneeName: 'Nguyễn Thiện', phaseName: 'Thiết kế', phaseId: 'p1' })
  })

  it('giới hạn 12 kết quả', () => {
    const many = Array.from({ length: 30 }, (_, i) => task(`n${i}`, `K-${i}`, `Task ${i}`))
    const s = { macroPhases: [phase('p', 'P')], trees: { p: tree(...many) }, members: [] }
    expect(searchProject('task', s)).toHaveLength(MAX_SEARCH_RESULTS)
  })
})
