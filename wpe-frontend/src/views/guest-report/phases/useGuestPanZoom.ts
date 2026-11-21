import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

export const GUEST_ZOOM_MIN = 0.3
export const GUEST_ZOOM_MAX = 1.6
export const GUEST_PAN_HINT = 'Drag to move · Ctrl + scroll to zoom'

export function clampGuestZoom(value: number): number {
  return Math.min(GUEST_ZOOM_MAX, Math.max(GUEST_ZOOM_MIN, +value.toFixed(2)))
}

export interface GuestPanZoomFit {
  start: number
  all: number
}

export interface GuestPanZoomBind {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClickCapture: (e: ReactMouseEvent<HTMLDivElement>) => void
}

export interface GuestPanZoomResult {
  ref: RefObject<HTMLDivElement>
  z: number
  bind: GuestPanZoomBind
  dragging: boolean
  zoomIn: () => void
  zoomOut: () => void
  fitAll: () => void
  reset: () => void
}

/**
 * Pan & zoom dành riêng cho sơ đồ ở trang khách (chép từ useDragZoom trong mock v6).
 * - Kéo bằng chuột trái để di chuyển; cảm ứng giữ nguyên để cuộn trang.
 * - Kéo xong nuốt click capture để không mở nhầm thẻ dưới con trỏ.
 * - Ctrl/Cmd + lăn chuột để phóng to/thu nhỏ quanh con trỏ; lăn chuột thường không bị chặn.
 */
export function useGuestPanZoom(
  fitOf: (box: { w: number; h: number }) => GuestPanZoomFit,
): GuestPanZoomResult {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 900, h: 400 })

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [zoom, setZoom] = useState<number | null>(null)
  const fit = fitOf(box)
  const z = zoom ?? fit.start
  const zRef = useRef(z)
  zRef.current = z

  const zoomAt = useCallback((nextZoom: number, px: number, py: number) => {
    const el = ref.current
    const ratio = nextZoom / zRef.current
    const cx = el ? el.scrollLeft + px : 0
    const cy = el ? el.scrollTop + py : 0
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      if (el) {
        el.scrollLeft = cx * ratio - px
        el.scrollTop = cy * ratio - py
      }
    })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      zoomAt(clampGuestZoom(zRef.current * factor), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const drag = useRef<{ x: number; y: number; sl: number; st: number; id: number } | null>(null)
  const dragged = useRef(false)
  const [dragging, setDragging] = useState(false)

  const bind: GuestPanZoomBind = {
    onPointerDown: (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const el = ref.current
      if (!el) return
      drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, id: e.pointerId }
      dragged.current = false
    },
    onPointerMove: (e) => {
      const d = drag.current
      const el = ref.current
      if (!d || !el) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!dragged.current) {
        if (Math.hypot(dx, dy) < 5) return
        dragged.current = true
        setDragging(true)
        try {
          el.setPointerCapture?.(d.id)
        } catch {
          // pointer already released
        }
      }
      el.scrollLeft = d.sl - dx
      el.scrollTop = d.st - dy
    },
    onPointerUp: () => {
      drag.current = null
      setDragging(false)
    },
    onPointerCancel: () => {
      drag.current = null
      setDragging(false)
    },
    onClickCapture: (e) => {
      if (dragged.current) {
        e.stopPropagation()
        e.preventDefault()
        dragged.current = false
      }
    },
  }

  const center = (): [number, number] => {
    const el = ref.current
    return el ? [el.clientWidth / 2, el.clientHeight / 2] : [0, 0]
  }

  return {
    ref,
    z,
    bind,
    dragging,
    zoomIn: () => zoomAt(clampGuestZoom(z + 0.15), ...center()),
    zoomOut: () => zoomAt(clampGuestZoom(z - 0.15), ...center()),
    fitAll: () => {
      setZoom(fit.all)
      requestAnimationFrame(() => {
        ref.current?.scrollTo?.({ left: 0, top: 0 })
      })
    },
    reset: () => setZoom(null),
  }
}
