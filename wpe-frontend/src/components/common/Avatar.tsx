import type { FC } from 'react'
import { getSavedAvatar } from '../../utils/avatarUtils'

const AV = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500']

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  index?: number
  className?: string
}

export const Avatar: FC<AvatarProps> = ({
  name,
  avatarUrl,
  index = 0,
  className = 'w-6 h-6 text-[9px]',
}) => {
  const resolvedUrl = avatarUrl || getSavedAvatar(name)

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={name}
        title={name}
        className={`inline-block rounded-full object-cover ring-2 ring-white select-none ${className}`}
      />
    )
  }

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
