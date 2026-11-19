import type { BranchGraphNode, GraphNodeMap, MacroPhase } from '../types/workflow.types'
import type { UserSummary } from '../types/kanban.types'
import { phaseDisplayName } from './phaseName'
import { findMember } from './memberLookup'

export const MAX_SEARCH_RESULTS = 12

export interface TaskSearchResult {
  kind: 'task'
  id: string
  code: string
  title: string
  phaseId: string
  phaseName: string
  /** Tên người làm; null nếu chưa giao. */
  assigneeName: string | null
  score: number
}

export interface PhaseSearchResult {
  kind: 'phase'
  id: string
  /** Giống `id`, để nơi dùng lấy đường dẫn phase cho cả hai loại kết quả. */
  phaseId: string
  name: string
  score: number
}

export type SearchResult = TaskSearchResult | PhaseSearchResult

export interface SearchSource {
  macroPhases: readonly MacroPhase[]
  trees: Record<string, GraphNodeMap>
  members: readonly UserSummary[]
}

/** Hạ chữ thường, bỏ dấu tiếng Việt (NFD rồi bỏ dấu kết hợp, đ -> d), gom khoảng trắng. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Điểm một trường: khớp hệt > bắt đầu bằng > chứa. 0 nếu không khớp. */
function fieldScore(field: string, query: string, exact: number, starts: number, contains: number): number {
  if (!field) return 0
  if (field === query) return exact
  if (field.startsWith(query)) return starts
  if (field.includes(query)) return contains
  return 0
}

/**
 * Tìm task và phase của dự án đang mở trên dữ liệu có sẵn ở trình duyệt (không gọi API).
 * Xếp hạng: mã task khớp hệt > mã bắt đầu bằng > tên bắt đầu bằng > mã chứa > tên chứa > người làm > tên phase.
 * Trả tối đa 12 kết quả.
 */
export function searchProject(query: string, source: SearchSource): SearchResult[] {
  const q = normalizeText(query)
  if (!q) return []
  const results: SearchResult[] = []

  for (const phase of source.macroPhases) {
    const name = phaseDisplayName(phase)
    const score = fieldScore(normalizeText(name), q, 95, 70, 45)
    if (score > 0) results.push({ kind: 'phase', id: phase.id, phaseId: phase.id, name, score })
  }

  for (const phase of source.macroPhases) {
    const tree = source.trees[phase.id]
    if (!tree) continue
    const phaseName = phaseDisplayName(phase)
    const normalizedPhaseName = normalizeText(phaseName)
    for (const node of Object.values(tree)) {
      if (node.kind !== 'branch' || (node as BranchGraphNode).isTrack) continue
      const task = node as BranchGraphNode
      const assigneeName = findMember(source.members, task.assignee)?.name ?? null
      const score = Math.max(
        fieldScore(normalizeText(task.code), q, 100, 80, 50),
        fieldScore(normalizeText(task.title), q, 65, 60, 40),
        fieldScore(normalizeText(assigneeName), q, 25, 25, 20),
        // Gõ tên phase thì liệt kê cả task thuộc phase đó, nhưng xếp sau mọi khớp trực tiếp
        normalizedPhaseName.includes(q) ? 5 : 0,
      )
      if (score <= 0) continue
      results.push({
        kind: 'task',
        id: task.id,
        code: task.code,
        title: task.title,
        phaseId: phase.id,
        phaseName,
        assigneeName,
        score,
      })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.kind !== b.kind) return a.kind === 'task' ? -1 : 1
    const labelA = a.kind === 'task' ? a.code : a.name
    const labelB = b.kind === 'task' ? b.code : b.name
    return labelA.localeCompare(labelB)
  })
  return results.slice(0, MAX_SEARCH_RESULTS)
}
