import { useId } from 'react'

interface SparkleIconProps { className?: string }

export function SparkleIcon({ className = 'h-4 w-4' }: SparkleIconProps) {
  const id = useId().replace(/:/g, '')
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke={`url(#${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <defs><linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#7c3aed" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
    <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </svg>
}
