interface ProgressRingProps { percent: number; size?: number }

export function ProgressRing({ percent, size = 56 }: ProgressRingProps) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  return <svg width={size} height={size} viewBox="0 0 56 56" aria-label={`${percent}% hoàn tất`}>
    <circle cx="28" cy="28" r={radius} stroke="#e0e7ff" strokeWidth="6" fill="none" />
    <circle cx="28" cy="28" r={radius} stroke="#6366f1" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} transform="rotate(-90 28 28)" />
    <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4338ca">{percent}%</text>
  </svg>
}
