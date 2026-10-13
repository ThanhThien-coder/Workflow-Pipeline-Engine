import type { FC } from 'react'

interface LogoProps {
  className?: string
  width?: number
  height?: number
}

export const Logo: FC<LogoProps> = ({ className, width = 26, height = 26 }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 26 26"
    fill="none"
    className={className}
    aria-label="Pipeline Engine Logo"
  >
    <rect x="1" y="1" width="24" height="24" rx="7" fill="#eef2ff" stroke="#6366f1" />
    <circle cx="7" cy="8" r="2.2" fill="#6366f1" />
    <circle cx="7" cy="18" r="2.2" fill="#38bdf8" />
    <circle cx="19" cy="13" r="2.2" fill="#10b981" />
    <path d="M9 8c5 0 4 5 8 5M9 18c5 0 4-5 8-5" stroke="#818cf8" strokeWidth="1.4" />
  </svg>
)
