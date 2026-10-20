import { useEffect, useRef, type FC } from 'react'
import { animate, useInView, useMotionValue } from 'framer-motion'
import clsx from 'clsx'
import { ease } from '../../lib/motion'

export interface CountUpProps {
  to: number
  from?: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

export const CountUp: FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.4,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: '-20px' })
  const motionVal = useMotionValue(from)

  const formatNumber = (num: number) => {
    return (
      prefix +
      num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) +
      suffix
    )
  }

  useEffect(() => {
    if (!isInView) return

    const controls = animate(motionVal, to, {
      duration,
      ease: ease.out,
      onUpdate: (latest) => {
        if (containerRef.current) {
          containerRef.current.textContent = formatNumber(latest)
        }
      },
    })

    return () => controls.stop()
  }, [isInView, to, duration, decimals, prefix, suffix])

  return (
    <span
      ref={containerRef}
      className={clsx('inline-block tabular-nums font-medium', className)}
    >
      {formatNumber(from)}
    </span>
  )
}
