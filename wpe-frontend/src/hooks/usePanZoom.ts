import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_SCALE = 0.15
export const MAX_SCALE = 1.8

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

/** Khung bao nội dung theo tọa độ của lớp nội dung (trước khi scale). */
export interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface FitOptions {
  /** Khoảng chừa quanh nội dung, tính theo px màn hình. */
  padding?: number
  /** Zoom lớn nhất khi fit: đồ thị nhỏ không bị phóng quá 100%. */
  maxScale?: number
  /** Lớp nội dung lệch so với góc khung nhìn (ví dụ margin của lớp nội dung). */
  contentOffset?: { x: number; y: number }
}

/**
 * Tính zoom và vị trí để toàn bộ nội dung vừa khung nhìn và nằm giữa (giống nút fit của Mermaid).
 * Lớp nội dung dùng `translate(pan) scale(scale)` với gốc biến đổi ở góc trên trái.
 */
export function computeFitTransform(
  bounds: ContentBounds,
  viewport: { width: number; height: number },
  { padding = 48, maxScale = 1, contentOffset = { x: 0, y: 0 } }: FitOptions = {}
): { scale: number; pan: { x: number; y: number } } {
  const contentW = Math.max(1, bounds.maxX - bounds.minX)
  const contentH = Math.max(1, bounds.maxY - bounds.minY)
  const availW = Math.max(1, viewport.width - padding * 2)
  const availH = Math.max(1, viewport.height - padding * 2)
  const scale = clampScale(Math.min(availW / contentW, availH / contentH, maxScale))
  return {
    scale,
    pan: {
      x: (viewport.width - contentW * scale) / 2 - bounds.minX * scale - contentOffset.x,
      y: (viewport.height - contentH * scale) / 2 - bounds.minY * scale - contentOffset.y,
    },
  }
}

export function usePanZoom() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const onWheel = useCallback((event: WheelEvent) => {
    if ((event.target as HTMLElement).closest('[data-pan-zoom-ignore]')) return
    event.preventDefault()
    setScale((current) => clampScale(current * (event.deltaY < 0 ? 1.1 : 0.9)))
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
  const zoomBy = (amount: number) => setScale((current) => clampScale(current + amount))

  /**
   * Zoom và căn giữa để `bounds` vừa khung nhìn. Khung nhìn chưa có kích thước (chưa vẽ xong) thì bỏ qua
   * và trả false để nơi gọi thử lại sau.
   */
  const fitToBounds = useCallback((bounds: ContentBounds | null, options?: FitOptions): boolean => {
    const viewport = viewportRef.current
    if (!viewport || !bounds) return false
    const width = viewport.clientWidth
    const height = viewport.clientHeight
    if (width <= 0 || height <= 0) return false
    const next = computeFitTransform(bounds, { width, height }, options)
    setScale(next.scale)
    setPan(next.pan)
    return true
  }, [])

  return {
    viewportRef,
    contentRef,
    scale,
    pan,
    setPan,
    transform: { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' as const },
    onMouseDown,
    onMouseMove,
    onMouseUp: stopPan,
    onMouseLeave: stopPan,
    zoomIn: () => zoomBy(0.1),
    zoomOut: () => zoomBy(-0.1),
    reset,
    fitToBounds,
  }
}
