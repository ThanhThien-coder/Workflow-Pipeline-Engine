import { useLayoutEffect, useRef } from 'react'

export function useFlip(wrapRef: React.RefObject<HTMLElement>) {
  const positions = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const bounds = wrap.getBoundingClientRect()
    const wrapWidth = wrap.offsetWidth
    const k = wrapWidth && Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width / wrapWidth : 1
    const safeK = Number.isFinite(k) && k > 0 ? k : 1

    const next = new Map<string, { x: number; y: number }>()
    wrap.querySelectorAll<HTMLElement>('[data-node-id]').forEach((element) => {
      const id = element.dataset.nodeId
      if (!id) return
      const rect = element.getBoundingClientRect()
      if (
        !Number.isFinite(rect.left) ||
        !Number.isFinite(rect.top) ||
        !Number.isFinite(bounds.left) ||
        !Number.isFinite(bounds.top)
      ) {
        return
      }

      const posX = (rect.left - bounds.left) / safeK
      const posY = (rect.top - bounds.top) / safeK
      if (!Number.isFinite(posX) || !Number.isFinite(posY) || isNaN(posX) || isNaN(posY)) {
        return
      }

      const position = { x: posX, y: posY }
      const previous = positions.current.get(id)

      if (previous) {
        const dx = (previous.x - position.x) * safeK
        const dy = (previous.y - position.y) * safeK
        if (
          Number.isFinite(dx) &&
          Number.isFinite(dy) &&
          !isNaN(dx) &&
          !isNaN(dy) &&
          (Math.abs(dx) > 1 || Math.abs(dy) > 1) &&
          Math.abs(dx) < 600 &&
          Math.abs(dy) < 600
        ) {
          element.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: 'none' },
            ],
            { duration: 250, easing: 'cubic-bezier(.2,.7,.2,1)' }
          )
        }
      } else if (positions.current.size > 0) {
        element.animate(
          [
            { opacity: 0, transform: 'scale(.94)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 200, easing: 'ease-out' }
        )
      }
      next.set(id, position)
    })
    positions.current = next
  })
}
