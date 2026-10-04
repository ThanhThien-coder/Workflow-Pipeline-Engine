import { useState, type FC } from 'react'

const CARDS: [string, string, string][] = [
  ['WPE-021', 'Provision staging database', 'IN_PROGRESS'],
  ['WPE-024', 'Write migration for audit table', 'TODO'],
  ['WPE-027', 'Review OAuth scopes', 'TODO'],
  ['WPE-031', 'Load-test state engine', 'TODO'],
]

const STC: Record<string, string> = {
  TODO: '#0ea5e9',
  IN_PROGRESS: '#2563eb',
}

export const MiniKanban: FC = () => {
  const [p, setP] = useState(0)
  const H = 64
  const G = 10
  const STEP = 2 * (H + G)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-slate-700">
          My Tasks · <span className="text-slate-400">{p + 1}/2</span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Up"
            disabled={p === 0}
            onClick={() => setP(0)}
            className="w-7 h-7 rounded-md border border-slate-200 text-slate-700 disabled:opacity-30 hover:bg-slate-50 transition-colors"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Down"
            disabled={p === 1}
            onClick={() => setP(1)}
            className="w-7 h-7 rounded-md border border-slate-200 text-slate-700 disabled:opacity-30 hover:bg-slate-50 transition-colors"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="overflow-hidden" style={{ height: 2 * H + G }}>
        <div className="flex flex-col" style={{ gap: G }}>
          {CARDS.map(([id, t, s], i) => (
            <div
              key={id}
              className="rounded-xl border border-slate-200/90 bg-white shadow-sm px-3 flex flex-col justify-center"
              style={{
                height: H,
                transform: `translate3d(0,-${p * STEP}px,0)`,
                transition: `transform 300ms cubic-bezier(.25,1,.5,1) ${i * 50}ms, opacity 300ms ${i * 50}ms`,
                opacity: Math.floor(i / 2) === p ? 1 : 0.4,
              }}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-[10px] text-slate-400">{id}</span>
                <span className="text-[9px] font-bold" style={{ color: STC[s] ?? '#2563eb' }}>
                  {s}
                </span>
              </div>
              {/* Corrected text color: text-slate-800 instead of text-slate-100 */}
              <div className="text-xs font-semibold text-slate-800 truncate">{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
