import type { FC } from 'react'

const AV = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500']

interface AvatarProps {
  name: string
  index?: number
  className?: string
}

export const Avatar: FC<AvatarProps> = ({
  name,
  index = 0,
  className = 'w-6 h-6 text-[9px]',
}) => {
  const bgClass = AV[Math.abs(index) % AV.length]
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      title={name}
      className={`inline-grid place-items-center rounded-full text-white font-bold ring-2 ring-white select-none ${bgClass} ${className}`}
    >
      {initials}
    </span>
  )
}
