import { useState, useEffect, type FC } from 'react'

const ST = ['LOCKED', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const
const STC: Record<string, string> = {
  LOCKED: '#94a3b8',
  TODO: '#0ea5e9',
  IN_PROGRESS: '#2563eb',
  REVIEW: '#7c3aed',
  DONE: '#059669',
}

const HN = [
  { id: 'Spec', x: 70, y: 130, o: 0 },
  { id: 'Design', x: 230, y: 50, o: 2 },
  { id: 'API', x: 230, y: 210, o: 2 },
  { id: 'Build', x: 400, y: 130, o: 4 },
  { id: 'Ship', x: 550, y: 130, o: 6 },
]

const HE: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [3, 4],
]

export const HeroDag: FC = () => {
  const [t, setT] = useState(0)

  useEffect(() => {
    const i = setInterval(() => setT((v) => (v + 1) % 13), 1100)
    return () => clearInterval(i)
  }, [])

  const getStatus = (n: (typeof HN)[number]) => {
    const idx = Math.max(0, Math.min(4, t - n.o))
    return ST[idx]
  }

  return (
    <svg viewBox="0 0 620 260" className="w-full" aria-label="Hero Directed Acyclic Graph Animation">
      {HE.map(([a, b], i) => {
        const A = HN[a]
        const B = HN[b]
        const mx = (A.x + B.x) / 2
        const d = `M${A.x + 38} ${A.y} C${mx} ${A.y} ${mx} ${B.y} ${B.x - 38} ${B.y}`
        const aStatus = getStatus(A)

        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.6" />
            <path
              d={d}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              className="flow"
              style={{ opacity: aStatus === 'DONE' ? 1 : 0.35 }}
            />
          </g>
        )
      })}

      {HN.map((n) => {
        const s = getStatus(n)
        const c = STC[s]

        return (
          <g key={n.id}>
            <rect
              x={n.x - 38}
              y={n.y - 20}
              width="76"
              height="40"
              rx="10"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="1.5"
            />
            <text
              x={n.x}
              y={n.y - 2}
              textAnchor="middle"
              fontSize="11"
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
              fill={c}
            >
              {s}
            </text>
            {s === 'IN_PROGRESS' && (
              <circle cx={n.x + 38} cy={n.y - 20} r="4" fill={c} className="pulse2" />
            )}
          </g>
        )
      })}
    </svg>
  )
}
