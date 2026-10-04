import { useEffect, useRef, useState } from 'react'

export function useResizable(defaultW: number) {
  const [w, setW] = useState(defaultW)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(false)

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!drag.current) return
      const min = window.innerWidth * 0.35
      const max = window.innerWidth * 0.8
      setW(Math.min(max, Math.max(min, window.innerWidth - event.clientX)))
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = false
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    drag.current = true
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    event.preventDefault()
  }

  return { w, dragging, onMouseDown }
}
