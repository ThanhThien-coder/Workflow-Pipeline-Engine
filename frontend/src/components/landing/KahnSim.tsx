import { useState, type FC } from 'react'

const N = [60, 190, 320]

export const KahnSim: FC = () => {
  const [cyc, setCyc] = useState(false)
  const [toast, setToast] = useState(false)

  const handleInjectCycle = () => {
    setCyc(true)
    setToast(true)
    setTimeout(() => setToast(false), 3200)
  }

  const handleValidWorkflow = () => {
    setCyc(false)
    setToast(false)
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={handleValidWorkflow}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            !cyc
              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Valid Workflow
        </button>
        <button
          type="button"
          onClick={handleInjectCycle}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            cyc
              ? 'border-rose-300 text-rose-700 bg-rose-50'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Inject Dependency Cycle
        </button>
      </div>

      {toast && (
        <div className="pop fixed top-20 right-5 z-[70] text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 shadow-md">
          400 Bad Request: Cycle Detected
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl bg-slate-50 border border-slate-200/90">
        <svg viewBox="0 0 380 150" className="w-full" aria-label="Kahn Algorithm Simulation Graph">
          {[0, 1].map((i) => (
            <path
              key={i}
              d={`M${N[i] + 28} 55 L${N[i + 1] - 28} 55`}
              stroke={cyc ? '#f43f5e' : '#059669'}
              strokeWidth="2"
              className="flow"
            />
          ))}
          {cyc && (
            <path
              d={`M${N[2]} 78 C${N[2]} 140 ${N[0]} 140 ${N[0]} 78`}
              fill="none"
              stroke="#e11d48"
              strokeWidth="2"
              className="flow"
            />
          )}
          {N.map((x, i) => (
            <g key={i}>
              <rect
                x={x - 28}
                y="32"
                width="56"
                height="46"
                rx="10"
                fill="#ffffff"
                stroke={cyc ? '#f43f5e' : '#059669'}
              />
              <text
                x={x}
                y="52"
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#0f172a"
              >
                Node-0{i + 1}
              </text>
              <text
                x={x}
                y="66"
                textAnchor="middle"
                fontSize="7.5"
                fill="#94a3b8"
              >
                P{i + 1}
              </text>
            </g>
          ))}
        </svg>
        {cyc && (
          <div
            key="sw"
            className="sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-rose-400/30 to-transparent pointer-events-none"
          />
        )}
      </div>

      <div
        className={`mt-3 text-xs font-mono rounded-lg px-3 py-2 border transition-all ${
          cyc
            ? 'border-rose-200 bg-rose-50 text-rose-700 pop'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        {cyc
          ? "400 Bad Request: Cycle detected via Kahn's Algorithm [Node-03 -> Node-01]"
          : '200 OK: 3/3 nodes visited. Graph is acyclic.'}
      </div>
    </div>
  )
}
