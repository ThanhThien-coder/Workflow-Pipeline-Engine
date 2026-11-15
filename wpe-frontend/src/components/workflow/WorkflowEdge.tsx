import type { EdgeRoute } from '../../utils/phaseColumnLayout'

/** Id marker mũi tên khai báo trong <defs> của SVG canvas (MacroWorkflow). */
export const EDGE_ARROW_ID = 'phase-edge-arrow'
export const EDGE_ARROW_ACTIVE_ID = 'phase-edge-arrow-active'

export type EdgeHighlight = 'normal' | 'on' | 'dim'

/**
 * Dây nối 2 phase. Đường đi tính sẵn ở utils/phaseColumnLayout (vuông góc, chạy trong khe giữa các cột).
 * highlight: 'on' khi dây ra/vào phase đang chọn hoặc rê chuột, 'dim' cho các dây còn lại lúc đó.
 */
export function WorkflowEdge({
  sourceId,
  targetId,
  route,
  highlight = 'normal',
  onDisconnect,
}: {
  sourceId: string
  targetId: string
  route: EdgeRoute
  highlight?: EdgeHighlight
  onDisconnect?: (sourceId: string, targetId: string) => void
}) {
  const active = highlight === 'on'
  return (
    <g
      className="group/edge transition-opacity"
      data-edge={`${sourceId}->${targetId}`}
      data-highlight={highlight}
      opacity={highlight === 'dim' ? 0.25 : 1}
    >
      <path
        d={route.d}
        fill="none"
        stroke={active ? '#4f46e5' : '#94a3b8'}
        strokeWidth={active ? 3 : 2}
        strokeDasharray={active ? undefined : '6 5'}
        strokeLinejoin="round"
        markerEnd={`url(#${active ? EDGE_ARROW_ACTIVE_ID : EDGE_ARROW_ID})`}
        className="transition-colors group-hover/edge:stroke-blue-500"
      />
      {/* Vùng bấm rộng để rê chuột / gỡ dây dễ hơn */}
      <path d={route.d} fill="none" stroke="transparent" strokeWidth="16" className="pointer-events-auto cursor-pointer" />
      {onDisconnect && (
        <g
          transform={`translate(${route.mid.x}, ${route.mid.y})`}
          className="pointer-events-auto cursor-pointer opacity-30 group-hover/edge:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDisconnect(sourceId, targetId)
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
