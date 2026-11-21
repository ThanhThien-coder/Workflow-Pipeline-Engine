import { useEffect, useRef, useState } from 'react'
import type { GuestBurnUpBucket, GuestBurnUpUnit, GuestReportModel } from '../../../domain/guestReport'
import { Card, Sub, fmtDay } from '../ui'

const VN_TZ = 'Asia/Ho_Chi_Minh'

function niceStep(raw: number): number {
  const safe = Math.max(raw, 1)
  const mag = Math.pow(10, Math.floor(Math.log10(safe)))
  const mult = [1, 2, 5, 10].find((s) => s * mag >= safe) ?? 10
  return mult * mag
}

const UNIT_WORD: Record<GuestBurnUpUnit, string> = {
  day: 'day by day',
  week: 'week by week',
  month: 'month by month',
}

function formatAxisLabel(date: Date, unit: GuestBurnUpUnit): string {
  if (unit === 'month') {
    return date.toLocaleDateString('en-GB', { month: 'short', timeZone: VN_TZ })
  }
  return fmtDay(date)
}

function formatTooltipHeading(bucket: GuestBurnUpBucket, unit: GuestBurnUpUnit): string {
  if (unit === 'day') return fmtDay(bucket.start)
  if (unit === 'week') return `Week of ${fmtDay(bucket.start)}`
  return bucket.start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: VN_TZ })
}

export function BurnUpChart({ model }: { model: GuestReportModel }) {
  const { unit, buckets } = model.burnUp
  const { completed, lastDueDate } = model.metrics
  const [hover, setHover] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(680)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const initialWidth = Math.round(el.getBoundingClientRect().width)
    if (initialWidth > 0) setWidth(Math.max(280, initialWidth))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const nextWidth = Math.max(280, Math.round(entry.contentRect.width))
      if (nextWidth > 0) setWidth(nextWidth)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const legend = (
    <div className="flex shrink-0 gap-3 text-[11px] text-slate-500">
      <span className="flex items-center gap-1">
        <span className="h-0.5 w-4 bg-indigo-500" />
        Done
      </span>
      <span className="flex items-center gap-1">
        <span className="w-4 border-t-2 border-dashed border-slate-400" />
        Scope
      </span>
    </div>
  )

  if (buckets.length === 0) {
    return (
      <Card
        title="Progress over time"
        note={
          <Sub>
            Tasks finished (cumulative) against total scope, {UNIT_WORD[unit]}. A flat line followed by a jump means
            work was crammed.
          </Sub>
        }
        right={legend}
      >
        <p className="py-8 text-center text-xs text-slate-400">No progress data yet.</p>
      </Card>
    )
  }

  const n = buckets.length
  const height = width < 480 ? 190 : 230
  const pad = { l: 36, r: 14, t: 16, b: 28 }
  const iw = Math.max(1, width - pad.l - pad.r)
  const ih = Math.max(1, height - pad.t - pad.b)

  const maxScope = Math.max(1, ...buckets.map((b) => b.scope))
  const step = niceStep(maxScope / 4)
  const maxY = Math.max(step, Math.ceil(maxScope / step) * step)

  const x = (i: number) => pad.l + (n > 1 ? (iw * i) / (n - 1) : iw / 2)
  const y = (v: number) => pad.t + ih - (ih * v) / maxY

  const past = buckets.map((b, i) => (b.done !== null ? i : -1)).filter((i) => i >= 0)
  const scopePath =
    n === 1
      ? `M${Math.max(pad.l, x(0) - 24)},${y(buckets[0].scope)} L${Math.min(width - pad.r, x(0) + 24)},${y(buckets[0].scope)}`
      : buckets.map((b, i) => `${i ? 'L' : 'M'}${x(i)},${y(b.scope)}`).join(' ')
  const donePath = past.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(buckets[i].done ?? 0)}`).join(' ')
  const doneArea =
    past.length > 0 ? `${donePath} L${x(past[past.length - 1])},${y(0)} L${x(past[0])},${y(0)} Z` : ''
  const todayX = past.length > 0 ? x(past[past.length - 1]) : x(0)
  const dIdx = lastDueDate
    ? buckets.reduce((k, b, i) => (b.start.getTime() <= lastDueDate.getTime() ? i : k), 0)
    : null

  const labelEvery = Math.max(1, Math.ceil(n / Math.min(8, Math.max(3, Math.floor(iw / 70)))))
  const ticks: number[] = []
  for (let v = 0; v <= maxY; v += step) ticks.push(v)

  const hovered = hover !== null ? buckets[hover] ?? null : null
  const hitWidth = iw / Math.max(n - 1, 1)

  return (
    <Card
      title="Progress over time"
      note={
        <Sub>
          Tasks finished (cumulative) against total scope, {UNIT_WORD[unit]}. A flat line followed by a jump means work
          was crammed.
        </Sub>
      }
      right={legend}
    >
      <div ref={boxRef} className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          className="block"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="guestBurnUpDoneFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6366f1" stopOpacity=".25" />
              <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {v}
              </text>
            </g>
          ))}

          {buckets.map((b, i) =>
            i % labelEvery === 0 ? (
              <text
                key={b.start.getTime()}
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : x(i) > width - pad.r - 24 ? 'end' : 'middle'}
                fontSize="10"
                fill="#94a3b8"
              >
                {formatAxisLabel(b.start, unit)}
              </text>
            ) : null,
          )}

          {past.length > 0 && (
            <rect x={todayX} y={pad.t} width={Math.max(0, width - pad.r - todayX)} height={ih} fill="#f8fafc" />
          )}

          <path d={scopePath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
          {n === 1 && (
            <circle cx={x(0)} cy={y(buckets[0].scope)} r={3} fill="#94a3b8" stroke="#fff" strokeWidth="1.5" />
          )}
          {doneArea && <path d={doneArea} fill="url(#guestBurnUpDoneFill)" />}
          {donePath && <path d={donePath} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />}

          {n <= 40 &&
            past.map((i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(buckets[i].done ?? 0)}
                r={hover === i ? 5 : 3}
                fill="#4f46e5"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}

          {!completed && past.length > 0 && (
            <>
              <line x1={todayX} x2={todayX} y1={pad.t} y2={pad.t + ih} stroke="#4f46e5" strokeDasharray="3 3" />
              <text
                x={todayX + 4 > width - pad.r - 32 ? todayX - 4 : todayX + 4}
                y={pad.t + 10}
                textAnchor={todayX + 4 > width - pad.r - 32 ? 'end' : 'start'}
                fontSize="10"
                fill="#4f46e5"
                fontWeight="600"
              >
                Today
              </text>
            </>
          )}

          {dIdx !== null && (
            <>
              <line x1={x(dIdx)} x2={x(dIdx)} y1={pad.t} y2={pad.t + ih} stroke="#e11d48" strokeDasharray="3 3" />
              <text
                x={x(dIdx) - 4 < pad.l + 58 ? x(dIdx) + 4 : x(dIdx) - 4}
                y={pad.t + ih - 6}
                fontSize="10"
                fill="#e11d48"
                fontWeight="600"
                textAnchor={x(dIdx) - 4 < pad.l + 58 ? 'start' : 'end'}
              >
                Planned end
              </text>
            </>
          )}

          {buckets.map((b, i) => (
            <rect
              key={b.start.getTime()}
              x={x(i) - hitWidth / 2}
              y={pad.t}
              width={hitWidth}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && hover !== null && (() => {
          const hoverX = x(hover)
          const onRightHalf = hoverX > width / 2
          const tooltipStyle = onRightHalf
            ? { right: `${Math.min(25, Math.max(0, ((width - hoverX) / width) * 100))}%` }
            : { left: `${Math.min(25, Math.max(0, (hoverX / width) * 100))}%` }

          return (
            <div
              className="pointer-events-none absolute top-2 max-w-[min(240px,75%)] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={tooltipStyle}
            >
              <div className="font-semibold text-slate-800">{formatTooltipHeading(hovered, unit)}</div>
              <div className="text-slate-600">Scope: {hovered.scope} tasks</div>
              {hovered.future ? (
                <div className="text-slate-400">Not reached yet</div>
              ) : (
                <>
                  <div className="text-indigo-700">Done so far: {hovered.done ?? 0}</div>
                  <div className="text-slate-500">
                    Finished in this period:{' '}
                    {hovered.finishedTasks.length > 0
                      ? hovered.finishedTasks
                          .slice(0, 5)
                          .map((t) => t.code)
                          .join(', ') +
                        (hovered.finishedTasks.length > 5 ? ` +${hovered.finishedTasks.length - 5}` : '')
                      : 'none'}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>
    </Card>
  )
}
