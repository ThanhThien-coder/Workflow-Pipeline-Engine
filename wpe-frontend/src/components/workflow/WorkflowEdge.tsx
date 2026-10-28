import type { MacroPhase } from '../../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'

export function WorkflowEdge({
  a,
  b,
  positions,
  onDisconnect,
}: {
  a?: MacroPhase
  b?: MacroPhase
  positions: Record<string, { x: number; y: number }>
  onDisconnect?: (sourceId: string, targetId: string) => void
}) {
  if (!a || !b) return null
  const aPosition = positions[a.id]
  const bPosition = positions[b.id]
  if (!aPosition || !bPosition) return null
  if (
    !Number.isFinite(aPosition.x) ||
    !Number.isFinite(aPosition.y) ||
    !Number.isFinite(bPosition.x) ||
    !Number.isFinite(bPosition.y) ||
    isNaN(aPosition.x) ||
    isNaN(aPosition.y) ||
    isNaN(bPosition.x) ||
    isNaN(bPosition.y)
  ) {
    return null
  }
  const x1 = aPosition.x + MACRO_CARD_W
  const y1 = aPosition.y + MACRO_CARD_H / 2
  const x2 = bPosition.x
  const y2 = bPosition.y + MACRO_CARD_H / 2
  const dx = Math.max((x2 - x1) * 0.5, 40)
  if (!Number.isFinite(dx) || isNaN(dx)) return null
  const pathData = `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`
  if (pathData.includes('NaN') || pathData.includes('undefined')) return null

  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <g className="group/edge">
      <path
        d={pathData}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2.5"
        strokeDasharray="5 5"
        className="transition-colors group-hover/edge:stroke-blue-500"
      />
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth="16"
        className="pointer-events-auto cursor-pointer"
      />
      {onDisconnect && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="pointer-events-auto cursor-pointer opacity-30 group-hover/edge:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDisconnect(a.id, b.id)
          }}
        >
          <circle
            r="11"
            className="fill-white stroke-slate-300 shadow hover:fill-rose-50 hover:stroke-rose-500 transition-colors"
            strokeWidth="1.5"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[12px] font-bold fill-slate-500 hover:fill-rose-600 select-none pointer-events-none"
          >
            ✕
          </text>
        </g>
      )}
    </g>
  )
}
