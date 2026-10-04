import { useLayoutEffect, useRef } from 'react'

export function useFlip(wrapRef: React.RefObject<HTMLElement>) {
  const positions = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const bounds = wrap.getBoundingClientRect()
    const k = wrap.offsetWidth ? bounds.width / wrap.offsetWidth : 1
    const next = new Map<string, { x: number; y: number }>()
    wrap.querySelectorAll<HTMLElement>('[data-node-id]').forEach((element) => {
      const id = element.dataset.nodeId
      if (!id) return
      const rect = element.getBoundingClientRect()
      const position = { x: (rect.left - bounds.left) / k, y: (rect.top - bounds.top) / k }
      const previous = positions.current.get(id)
      if (previous && (Math.abs(previous.x - position.x) > 1 || Math.abs(previous.y - position.y) > 1)) {
        element.animate([{ transform: `translate(${(previous.x - position.x) * k}px,${(previous.y - position.y) * k}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' })
      } else if (!previous && positions.current.size > 0) {
        element.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: 'ease-out' })
      }
      next.set(id, position)
    })
    positions.current = next
  })
}
