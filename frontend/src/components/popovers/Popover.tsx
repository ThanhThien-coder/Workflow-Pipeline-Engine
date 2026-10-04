import { useEffect, useRef } from 'react'

export function Popover({ x, y, w, onClose, children }: { x: number; y: number; w: number; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const onMouse = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) onClose() }
    window.addEventListener('keydown', onKey); window.addEventListener('mousedown', onMouse)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onMouse) }
  }, [onClose])
  const isBottomHalf = y > window.innerHeight / 2
  const safeLeft = Math.max(8, Math.min(x, window.innerWidth - w - 8))
  const safeTop = isBottomHalf ? 'auto' : Math.max(8, y)
  const safeBottom = isBottomHalf ? Math.max(8, window.innerHeight - y + 8) : 'auto'
  return <div ref={ref} className="fixed z-50 max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl" style={{ left: safeLeft, top: safeTop, bottom: safeBottom, width: w }}>{children}</div>
}
