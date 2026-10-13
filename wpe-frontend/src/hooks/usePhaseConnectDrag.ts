import { useRef, useState } from 'react'
import type { MacroPhase } from '../types/workflow.types'
import { isPhaseAncestor } from '../utils/spanningTreeLayout'

export function usePhaseConnectDrag(phases: MacroPhase[], onConnect: (sourceId: string, targetId: string) => Promise<void>, onSpawnChild: (sourceId: string) => Promise<void>) {
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [error, setError] = useState<{ x: number; y: number; message: string } | null>(null)
  const dragging = useRef(false)
  const start = (event: React.MouseEvent, sourceId: string) => {
    event.stopPropagation()
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const sx = rect.right - 3
    const sy = rect.top + rect.height / 2
    const startX = event.clientX
    const startY = event.clientY
    dragging.current = false
    const onMove = (move: MouseEvent) => {
      if (!dragging.current && Math.hypot(move.clientX - startX, move.clientY - startY) > 6) dragging.current = true
      if (dragging.current) setLine({ x1: sx, y1: sy, x2: move.clientX, y2: move.clientY })
    }
    const onUp = (up: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const wasDragged = dragging.current
      dragging.current = false
      setLine(null)
      if (!wasDragged) {
        void onSpawnChild(sourceId)
        return
      }
      const target = document.elementFromPoint(up.clientX, up.clientY)?.closest<HTMLElement>('[data-phase-id]')
      const targetId = target?.dataset.phaseId
      const phaseMap = Object.fromEntries(phases.map((phase) => [phase.id, phase]))
      const flash = (message: string) => {
        setError({ x: up.clientX, y: up.clientY, message })
        window.setTimeout(() => setError(null), 1800)
      }
      if (!targetId || targetId === sourceId) return
      const targetPhase = phaseMap[targetId]
      if (!targetPhase) return
      if (targetPhase.parentPhaseIds.includes(sourceId)) return flash('Liên kết giữa 2 Phase đã tồn tại')
      if (isPhaseAncestor(phaseMap, targetId, sourceId)) return flash('Không thể nối ngược (tránh chu trình lặp đồ thị)')
      void onConnect(sourceId, targetId).catch((cause: unknown) => flash(cause instanceof Error ? cause.message : 'Không thể nối Phase'))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return { line, error, onSpawnDown: start }
}
