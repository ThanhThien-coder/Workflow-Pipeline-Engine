import { useRef, useState } from 'react'
import { isAncestor } from '../utils/spanningTreeLayout'
import type { GraphNodeMap } from '../types/workflow.types'

export function useConnectDrag(nodes: GraphNodeMap, setNodes: (update: (nodes: GraphNodeMap) => GraphNodeMap) => void) {
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [error, setError] = useState<{ x: number; y: number; message: string } | null>(null)
  const suppressClickUntil = useRef(0)
  const startDrag = (event: React.MouseEvent, sourceId: string, onClick: (pos: { x: number; y: number }) => void) => {
    event.stopPropagation()
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const sx = rect.left + rect.width / 2
    const sy = rect.top + rect.height / 2
    const sx0 = event.clientX
    const sy0 = event.clientY
    let dragged = false
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragged && Math.hypot(moveEvent.clientX - sx0, moveEvent.clientY - sy0) > 6) dragged = true
      if (dragged) setLine({ x1: sx, y1: sy, x2: moveEvent.clientX, y2: moveEvent.clientY })
    }
    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setLine(null)
      suppressClickUntil.current = performance.now() + 80
      if (!dragged) {
        onClick({ x: sx, y: sy })
        return
      }
      const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>('[data-node-id]')
      const targetId = target?.dataset.nodeId
      const targetNode = targetId ? nodes[targetId] : undefined
      const flash = (message: string) => {
        setError({ x: upEvent.clientX, y: upEvent.clientY, message })
        window.setTimeout(() => setError(null), 1600)
      }
      if (!targetId || targetId === sourceId || !targetNode || (targetNode.kind !== 'branch' && targetNode.kind !== 'ghost')) return
      if (targetNode.kind === 'ghost' && nodes[sourceId]?.kind === 'ghost') return
      if (targetNode.parentIds.includes(sourceId)) return flash('Liên kết đã tồn tại')
      if (isAncestor(nodes, targetId, sourceId)) return flash('Không thể nối ngược (tránh chu trình lặp)')
      setNodes((current) => {
        const currentTarget = current[targetId]
        return { ...current, [targetId]: currentTarget.kind === 'branch' ? { ...currentTarget, parentIds: [...currentTarget.parentIds, sourceId], joinPolicy: currentTarget.joinPolicy || 'ALL_COMPLETED' } : { ...currentTarget, parentIds: [...currentTarget.parentIds, sourceId] } }
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return { line, error, startDrag }
}
