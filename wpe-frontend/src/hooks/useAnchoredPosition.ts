import { useLayoutEffect, useState, type RefObject } from 'react'

export interface AiPopoverPos { top: number; caret: number; origin: number }

export function computeCenteredPopover(btn: DOMRect, vw: number, maxW = 1024): AiPopoverPos {
  const width = Math.min(maxW, vw - 64)
  const left = (vw - width) / 2
  const btnCenter = btn.left + btn.width / 2
  const caret = Math.min(Math.max(btnCenter - left - 8, 20), width - 36)
  return { top: btn.bottom + 12, caret, origin: caret + 8 }
}

export function useAnchoredPosition(isOpen: boolean, buttonRef: RefObject<HTMLElement | null>): AiPopoverPos {
  const [position, setPosition] = useState<AiPopoverPos>({ top: 0, caret: 20, origin: 28 })
  useLayoutEffect(() => {
    if (!isOpen) return
    const update = () => {
      if (buttonRef.current) setPosition(computeCenteredPopover(buttonRef.current.getBoundingClientRect(), document.documentElement.clientWidth))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [buttonRef, isOpen])
  return position
}
