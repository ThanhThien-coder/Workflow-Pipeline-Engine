import { type FC, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import clsx from 'clsx'
import { spring } from '../../lib/motion'

export interface MixpanelBentoCardProps {
  children: ReactNode
  className?: string
  innerClassName?: string
  tone?: 'light' | 'dark'
}

export const MixpanelBentoCard: FC<MixpanelBentoCardProps> = ({
  children,
  className,
  innerClassName,
  tone = 'light',
}) => {
  const mx = useMotionValue(-1000)
  const my = useMotionValue(-1000)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Suspend spotlight calculation while scrolling to yield 100% resources for 60 FPS smooth scroll
    if (document.documentElement.classList.contains('lenis-scrolling')) {
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set(e.clientX - rect.left)
    my.set(e.clientY - rect.top)
  }

  const handleMouseLeave = () => {
    mx.set(-1000)
    my.set(-1000)
  }

  const borderSpotlight = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, rgba(176, 148, 255, 0.9), transparent 70%)`
  const bgSpotlight = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(120, 86, 255, 0.18), transparent 70%)`

  const isDark = tone === 'dark'

  return (
    <motion.div
      data-hover-spotlight="true"
      whileHover={{ y: -4 }}
      transition={spring.card}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'mixpanel-bento-card group relative rounded-3xl p-px transition-shadow duration-300',
        isDark
          ? 'bg-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_40px_rgba(120,86,255,0.25)]'
          : 'bg-mp-n-200/80 shadow-mp-card hover:shadow-mp-float',
        className
      )}
    >
      {/* Dynamic Border Spotlight */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: borderSpotlight }}
      />

      {/* Card Body */}
      <div
        className={clsx(
          'relative h-full w-full rounded-[calc(1.5rem-1px)] overflow-hidden transition-colors',
          isDark
            ? 'bg-[#15003F]/90 text-white backdrop-blur-xl'
            : 'bg-white text-mp-ink',
          innerClassName || 'p-6 sm:p-8'
        )}
      >
        {/* Dynamic Inner Background Spotlight Glow */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[calc(1.5rem-1px)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: bgSpotlight }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col">{children}</div>
      </div>
    </motion.div>
  )
}
