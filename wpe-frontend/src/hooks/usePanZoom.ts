import { useCallback, useEffect, useRef, useState } from 'react'

export function usePanZoom() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const onWheel = useCallback((event: WheelEvent) => {
    if ((event.target as HTMLElement).closest('[data-pan-zoom-ignore]')) return
    event.preventDefault()
    setScale((current) => Math.min(1.8, Math.max(0.4, current * (event.deltaY < 0 ? 1.1 : 0.9))))
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-node-id],button,input')) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    document.body.style.userSelect = 'none'
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
  }
  const onMouseMove = (event: React.MouseEvent) => {
    if (!drag.current) return
    setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y })
  }
  const stopPan = () => {
    drag.current = null
    document.body.style.userSelect = ''
  }
  useEffect(() => () => {
    document.body.style.userSelect = ''
  }, [])
  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }) }
  const zoomBy = (amount: number) => setScale((current) => Math.min(1.8, Math.max(0.4, current + amount)))

  return {
    viewportRef,
    contentRef,
    scale,
    pan,
    transform: { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' as const },
    onMouseDown,
    onMouseMove,
    onMouseUp: stopPan,
    onMouseLeave: stopPan,
    zoomIn: () => zoomBy(0.1),
    zoomOut: () => zoomBy(-0.1),
    reset,
  }
}
