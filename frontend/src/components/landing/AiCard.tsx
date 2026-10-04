import type { FC } from 'react'

const AX = [
  [100, 20],
  [176, 75],
  [147, 165],
  [53, 165],
  [24, 75],
]

const LABELS: [string, number, number, 'middle' | 'start' | 'end'][] = [
  ['Critical Path', 100, 11, 'middle'],
  ['Bottleneck', 184, 72, 'start'],
  ['Capacity', 150, 181, 'middle'],
  ['Velocity', 50, 181, 'middle'],
  ['SLA', 16, 72, 'end'],
]

const VAL = [0.92, 0.55, 0.85, 0.45, 0.7]

const pt = (k: number, i: number) =>
  `${100 + (AX[i][0] - 100) * k},${95 + (AX[i][1] - 95) * k}`

export const AiCard: FC = () => {
  const pts = VAL.map((v, i) => pt(v, i)).join(' ')

  return (
    <div className="py-1">
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 pulse2" />
        Live Telemetry Active · Monitored via Gemini Engine
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="flex flex-col items-center">
          <svg
            viewBox="-30 0 260 192"
            className="w-full max-w-[250px]"
            style={{ maxHeight: '26vh' }}
            aria-label="Topology Risk Factor Radar Chart"
          >
            {[1, 0.66, 0.33].map((k) => (
              <polygon
                key={k}
                points={AX.map((_, i) => pt(k, i)).join(' ')}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1.2"
              />
            ))}
            {AX.map(([x, y], i) => (
              <line key={i} x1="100" y1="95" x2={x} y2={y} stroke="#eef2f7" strokeWidth="1" />
            ))}
            <polygon
              points={pts}
              fill="rgba(99,102,241,0.18)"
              stroke="#6366f1"
              strokeWidth="1.8"
            />
            {LABELS.map(([t, x, y, a]) => (
              <text
                key={t}
                x={x}
                y={y}
                textAnchor={a}
                fontSize="8.5"
                fontWeight="600"
                fill="#64748b"
              >
                {t}
              </text>
            ))}
            <circle cx="100" cy={95 - 75 * 0.92} r="5" fill="#f43f5e" className="pulse2" />
          </svg>
          <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
            Topology Risk Factor
          </span>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-rose-700 border border-rose-200 bg-rose-50/80 rounded-xl p-3 leading-relaxed">
            <span className="font-bold block mb-0.5 text-rose-800">
              🔴 Critical Path Alert
            </span>
            Auth Token Service is delaying Phase 2B by 3.2 days.
          </div>
          <div className="text-xs text-emerald-700 border border-emerald-200 bg-emerald-50/80 rounded-xl p-3 leading-relaxed">
            <span className="font-bold block mb-0.5 text-emerald-800">
              🟢 AI Recommendation
            </span>
            Assign secondary backend engineer to unblock.
          </div>
        </div>
      </div>
    </div>
  )
}
