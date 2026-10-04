import type { MacroPhase } from '../../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'

export function WorkflowEdge({ a, b, positions }: { a?: MacroPhase; b?: MacroPhase; positions: Record<string, { x: number; y: number }> }) {
  if (!a || !b) return null
  const aPosition = positions[a.id]
  const bPosition = positions[b.id]
  if (!aPosition || !bPosition) return null
  const x1 = aPosition.x + MACRO_CARD_W
  const y1 = aPosition.y + MACRO_CARD_H / 2
  const x2 = bPosition.x
  const y2 = bPosition.y + MACRO_CARD_H / 2
  const dx = Math.max((x2 - x1) * 0.5, 40)
  return <path d={`M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 6" />
}
