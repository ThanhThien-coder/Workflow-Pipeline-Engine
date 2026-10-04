import { useState } from 'react'
import type { WeeklyVelocity } from '../../types/overview.types'

export function WeeklyVelocityCard({ velocity }: { velocity: WeeklyVelocity }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...velocity.days.map((day) => day.tasks), 1)
  return <div>
    <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Weekly Velocity</h3><span className="text-xs text-slate-500">{velocity.periodLabel}</span></div>
    <div className="flex gap-3"><div className="flex h-64 w-6 shrink-0 flex-col justify-between text-right text-[11px] text-slate-400">{[1, .75, .5, .25, 0].map((tick) => <span key={tick}>{Math.round(max * tick)}</span>)}</div>
      <div className="relative flex h-64 flex-1 items-end justify-around gap-2 border-b border-slate-200 bg-[linear-gradient(to_bottom,transparent_24.5%,#f1f5f9_25%,transparent_25.5%,transparent_49.5%,#f1f5f9_50%,transparent_50.5%,transparent_74.5%,#f1f5f9_75%,transparent_75.5%)] px-2">
        {velocity.days.map((day, index) => <div key={day.day} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
          {hover === index && <div className="absolute bottom-[calc(100%-1rem)] z-10 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-white">{day.tasks} tasks</div>}
          <div className={`bar w-full max-w-10 rounded-t-md ${day.isPeak ? 'bg-emerald-500' : 'bg-indigo-400'}`} style={{ height: `${(day.tasks / max) * 100}%` }} />
          <span className="mt-2 text-[11px] text-slate-500">{day.day}</span>
        </div>)}
      </div>
    </div>
  </div>
}
