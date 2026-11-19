import type { MacroPhase } from '../types/workflow.types'

/** Tên phase tự sinh kiểu cũ ("PHASE 3"): không mang nghĩa, chỉ là số thứ tự FE đặt. */
const LEGACY_NUMBER_NAME = /^phase\s*\d+$/i

/**
 * Tên hiển thị duy nhất của một phase (không còn đánh số "PHASE N").
 * Phase cũ có tên dạng "PHASE 3" và phụ đề có nghĩa thì hiện phụ đề; còn lại hiện tên.
 */
export function phaseDisplayName(phase: Pick<MacroPhase, 'name' | 'sub'> | null | undefined): string {
  if (!phase) return ''
  const name = (phase.name ?? '').trim()
  const sub = (phase.sub ?? '').trim()
  if (sub && (!name || LEGACY_NUMBER_NAME.test(name))) return sub
  return name || sub
}
