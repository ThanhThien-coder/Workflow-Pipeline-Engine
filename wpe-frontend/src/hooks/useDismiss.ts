import { useEffect, type RefObject } from 'react'

export function useDismiss(isOpen: boolean, onClose: () => void, refs: RefObject<HTMLElement | null>[]): void {
  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!refs.some((ref) => ref.current?.contains(target))) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose, refs])
}

export { useDismiss as useClickOutside }
