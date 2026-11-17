export interface IntegerAxis {
  /** Highest value on the axis (bars are scaled against this). */
  max: number
  /** Tick values from top to bottom; all integers, never repeated. */
  ticks: number[]
}

/** Integer-only Y axis for task counts: 0..max when small, otherwise 4 equal integer steps. */
export function integerAxis(rawMax: number): IntegerAxis {
  const peak = Math.max(1, Math.ceil(Number.isFinite(rawMax) ? rawMax : 1))
  if (peak <= 4) {
    return { max: peak, ticks: Array.from({ length: peak + 1 }, (_, i) => peak - i) }
  }
  const step = Math.ceil(peak / 4)
  return { max: step * 4, ticks: [4, 3, 2, 1, 0].map((i) => i * step) }
}
