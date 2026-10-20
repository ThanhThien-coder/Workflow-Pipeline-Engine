import { useRef, type FC, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import clsx from 'clsx'
import { spring } from '../../lib/motion'

export interface MagneticButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'white'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  type?: 'button' | 'submit'
  disabled?: boolean
  shimmer?: boolean
  ariaLabel?: string
}

export const MagneticButton: FC<MagneticButtonProps> = ({
  children,
  onClick,
  className,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'right',
  type = 'button',
  disabled = false,
  shimmer = true,
  ariaLabel,
}) => {
  const ref = useRef<HTMLButtonElement>(null)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const x = useSpring(rawX, spring.magnet)
  const y = useSpring(rawY, spring.magnet)

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current || document.documentElement.classList.contains('lenis-scrolling')) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    rawX.set((e.clientX - centerX) * 0.25)
    rawY.set((e.clientY - centerY) * 0.25)
  }

  const handleMouseLeave = () => {
    rawX.set(0)
    rawY.set(0)
  }

  const sizeStyles = {
    sm: 'px-4 py-2 text-xs font-semibold gap-1.5 rounded-full',
    md: 'px-5 py-2.5 sm:px-6 sm:py-3 text-sm font-semibold gap-2 rounded-full',
    lg: 'px-7 py-3.5 sm:px-8 sm:py-4 text-base font-semibold gap-2.5 rounded-full',
  }

  const variantStyles = {
    primary:
      'bg-mp-purple-150 hover:bg-mp-purple-100 text-white shadow-mp-glow active:scale-[0.98]',
    secondary:
      'bg-white text-mp-ink border border-mp-n-300 hover:border-mp-purple-100 hover:bg-mp-n-50 shadow-sm active:scale-[0.98]',
    white:
      'bg-white text-mp-purple-200 hover:bg-mp-n-50 shadow-mp-float active:scale-[0.98]',
    ghost:
      'bg-transparent text-mp-n-600 hover:text-mp-ink hover:bg-mp-n-100/60 active:scale-[0.98]',
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center justify-center cursor-pointer select-none overflow-hidden transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mp-purple-100 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {/* Subtle Shimmer highlight sweep */}
      {shimmer && variant === 'primary' && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      )}

      {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
      {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </motion.button>
  )
}
