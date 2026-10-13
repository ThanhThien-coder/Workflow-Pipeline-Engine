import { useState, useEffect, useRef, useCallback } from 'react'

export const SECTIONS = [
  '01. Overview',
  '02. Kahn Engine',
  '03. Quality Gates',
  '04. Diagnostics',
  '05. Get Started',
]

const TOTAL = SECTIONS.length
const COOLDOWN_MS = 600

export function useViewportSlider() {
  const [cur, setCur] = useState(0)
  const curRef = useRef(0)
  const lockRef = useRef(false)

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= TOTAL || index === curRef.current || lockRef.current) return

    lockRef.current = true
    curRef.current = index
    setCur(index)

    // Cooldown 600ms (transition is 550ms) to swallow wheel/trackpad inertia
    setTimeout(() => {
      lockRef.current = false
    }, COOLDOWN_MS)
  }, [])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (lockRef.current) return
      if (Math.abs(e.deltaY) > 25) {
        goTo(curRef.current + (e.deltaY > 0 ? 1 : -1))
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (lockRef.current || (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return

      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        goTo(curRef.current + 1)
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        goTo(curRef.current - 1)
      }
    }

    let touchStartY = 0
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (lockRef.current) return
      const dy = touchStartY - e.changedTouches[0].clientY
      if (Math.abs(dy) > 40) {
        goTo(curRef.current + (dy > 0 ? 1 : -1))
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [goTo])

  return {
    cur,
    goTo,
    total: TOTAL,
    sections: SECTIONS,
  }
}
