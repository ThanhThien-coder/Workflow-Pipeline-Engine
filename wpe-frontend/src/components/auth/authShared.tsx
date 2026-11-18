import type { FC, ReactNode } from 'react'

export const EyeIcon: FC<{ off: boolean }> = ({ off }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

export const Spinner: FC = () => (
  <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
)

const NODES = [
  { id: 'Spec', x: 60, y: 150, st: 'DONE' },
  { id: 'Build API', x: 165, y: 80, st: 'DONE' },
  { id: 'PR Review', x: 270, y: 150, st: 'IN_PROGRESS' },
  { id: 'Production Ship', x: 375, y: 80, st: 'LOCKED' },
]

const STC: Record<string, string> = {
  DONE: '#059669',
  IN_PROGRESS: '#2563eb',
  LOCKED: '#94a3b8',
}

export function Showcase() {
  const edges = NODES.slice(0, -1).map((a, i) => {
    const b = NODES[i + 1]
    const x1 = a.x + 42
    const x2 = b.x - 42
    const mx = (x1 + x2) / 2
    return `M${x1} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${x2} ${b.y}`
  })

  return (
    <div className="hidden lg:flex relative flex-col justify-center items-center overflow-hidden border-l border-slate-200/80 bg-slate-50/70 px-10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.6,
        }}
      />
      <div
        className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-lg space-y-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl p-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
            <span className="font-mono">pipeline/release.dag</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse2" />
              engine running
            </span>
          </div>
          <svg viewBox="0 0 440 230" className="w-full" aria-label="Ambient DAG Showcase">
            {edges.map((d, i) => (
              <g key={i}>
                <path d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.6" />
                <path
                  d={d}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="flow"
                  opacity={i < 2 ? 1 : 0.35}
                />
                {i < 2 && (
                  <circle r="3.5" fill="#6366f1">
                    <animateMotion dur={`${2.2 + i * 0.4}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            ))}
            {NODES.map((n) => (
              <g key={n.id}>
                <rect
                  x={n.x - 42}
                  y={n.y - 22}
                  width="84"
                  height="44"
                  rx="11"
                  fill="#fff"
                  stroke="#e2e8f0"
                  strokeWidth="1.5"
                />
                <text
                  x={n.x}
                  y={n.y - 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#0f172a"
                >
                  {n.id}
                </text>
                <text
                  x={n.x}
                  y={n.y + 12}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill={STC[n.st]}
                >
                  {n.st}
                </text>
                {n.st === 'IN_PROGRESS' && (
                  <circle
                    cx={n.x + 42}
                    cy={n.y - 22}
                    r="4.5"
                    fill={STC[n.st]}
                    className="pulse2"
                  />
                )}
              </g>
            ))}
          </svg>
        </div>

        <blockquote className="text-xl font-semibold text-slate-900 leading-snug">
          “Deterministic execution with <span className="grad-text">zero state bypass.</span> Every pipeline step is verified mathematically before deployment.”
        </blockquote>

        <div className="flex flex-wrap gap-2">
          {[
            '🔒 Strict Role-Based Access Control (RBAC)',
            '⚡ Kahn’s Topological Cycle Prevention',
            '🛡 Zero-Trust Artifact Verification',
          ].map((b) => (
            <span
              key={b}
              className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-full px-3 py-1 shadow-sm"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  error?: string | null
  children: ReactNode
  right?: ReactNode
}

export const Field: FC<FieldProps> = ({ label, error, children, right }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-xs font-semibold text-slate-800">{label}</label>
      {right}
    </div>
    {children}
    {error && <p className="mt-1 text-[11px] font-medium text-rose-600 fade">{error}</p>}
  </div>
)

export const inputCls = (err?: string | null) =>
  `w-full text-sm rounded-xl border bg-white px-3.5 py-2.5 outline-none transition-colors placeholder:text-slate-400 ${
    err ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200/90 focus:border-indigo-500'
  }`
