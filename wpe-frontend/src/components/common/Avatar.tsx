import { useEffect, useState } from 'react'
import type { FC, ReactNode } from 'react'
import { getSavedAvatar } from '../../utils/avatarUtils'

const AV = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500']

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  index?: number
  className?: string
}

interface AvatarImageProps {
  src?: string | null
  alt: string
  /** class của thẻ img */
  className?: string
  /** hiện khi không có ảnh hoặc ảnh tải lỗi (vd. file đã bị xóa) */
  fallback: ReactNode
}

/** Ảnh tròn tự quay về `fallback` (chữ viết tắt) khi ảnh tải lỗi. */
export const AvatarImage: FC<AvatarImageProps> = ({ src, alt, className, fallback }) => {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) return <>{fallback}</>

  return (
    <img
      src={src}
      alt={alt}
      title={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}

export const Avatar: FC<AvatarProps> = ({
  name,
  avatarUrl,
  index = 0,
  className = 'w-6 h-6 text-[9px]',
}) => {
  const resolvedUrl = avatarUrl || getSavedAvatar(name)

  const bgClass = AV[Math.abs(index) % AV.length]
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <AvatarImage
      src={resolvedUrl}
      alt={name}
      className={`inline-block rounded-full object-cover ring-2 ring-white select-none ${className}`}
      fallback={
        <span
          title={name}
          className={`inline-grid place-items-center rounded-full text-white font-bold ring-2 ring-white select-none ${bgClass} ${className}`}
        >
          {initials}
        </span>
      }
    />
  )
}
