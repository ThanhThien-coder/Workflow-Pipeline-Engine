import { useCallback, useLayoutEffect, useRef } from 'react'

export interface EdgeFocus { id: string; target?: string }

export function useEdgeRenderer() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const baseRef = useRef<SVGSVGElement | null>(null)
  const beamRef = useRef<SVGSVGElement | null>(null)
  const hoverRef = useRef<EdgeFocus | null>(null)
  const frameRef = useRef(0)

  const drawEdges = useCallback(() => {
    const wrap = wrapRef.current
    const base = baseRef.current
    const beam = beamRef.current
    if (!wrap || !base || !beam) return
    const bounds = wrap.getBoundingClientRect()
    const k = wrap.offsetWidth ? bounds.width / wrap.offsetWidth : 1
    const elements = [...wrap.querySelectorAll<HTMLElement>('[data-node-id]')]
    const positions = new Map<string, { left: number; right: number; centerY: number; ghost: boolean }>()
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect()
      if (element.dataset.nodeId) positions.set(element.dataset.nodeId, { left: (rect.left - bounds.left) / k, right: (rect.right - bounds.left) / k, centerY: ((rect.top + rect.bottom) / 2 - bounds.top) / k, ghost: element.dataset.ghost === '1' })
    })
    const hovered = hoverRef.current
    const related: Record<string, 'self' | 'up' | 'down'> = {}
    if (hovered?.id && positions.has(hovered.id)) related[hovered.id] = 'self'
    let dim = ''
    let lit = ''
    let beamMarkup = ''
    elements.forEach((element) => {
      const child = element.dataset.nodeId ? positions.get(element.dataset.nodeId) : undefined
      if (!child || !element.dataset.parents) return
      element.dataset.parents.split(',').filter(Boolean).forEach((parentId) => {
        const parent = positions.get(parentId)
        if (!parent) return
        const direct = element.dataset.primary === parentId
        let mode: 'up' | 'down' | null = null
        if (hovered) {
          if (hovered.target) {
            if (element.dataset.nodeId === hovered.id && parentId === hovered.target) mode = 'up'
            else if (parentId === hovered.id && element.dataset.nodeId === hovered.target) mode = 'down'
          } else if (element.dataset.nodeId === hovered.id) mode = 'up'
          else if (parentId === hovered.id) mode = 'down'
        }
        if (mode) related[mode === 'up' ? parentId : element.dataset.nodeId!] = mode
        if (!direct && !mode) return
        const dx = Math.max((child.left - parent.right) * 0.5, 48)
        const path = `M${parent.right} ${parent.centerY} C${parent.right + dx} ${parent.centerY} ${child.left - dx} ${child.centerY} ${child.left} ${child.centerY}`
        const ghost = parent.ghost || child.ghost
        if (mode) {
          const up = mode === 'up'
          const markup = `<path d="${path}" fill="none" stroke="${up ? '#2563eb' : '#10b981'}" stroke-width="2.5" stroke-linecap="round"${direct ? '' : ' stroke-dasharray="6 4"'} style="filter:drop-shadow(0 0 3px ${up ? 'rgba(37,99,235,.65)' : 'rgba(16,185,129,.65)'})"/>`
          if (direct) lit += markup
          else beamMarkup += markup
        } else {
          dim += `<path d="${path}" fill="none" stroke="${ghost ? '#a5a3d4' : '#cbd5e1'}" stroke-width="1.5"${ghost ? ' stroke-dasharray="4 4"' : ''}${hovered ? ' opacity=".06"' : ''}/>`
        }
      })
    })
    elements.forEach((element) => {
      const rel = element.dataset.nodeId ? related[element.dataset.nodeId] : undefined
      if (rel) element.dataset.rel = rel
      else delete element.dataset.rel
    })
    base.setAttribute('width', String(wrap.offsetWidth)); base.setAttribute('height', String(wrap.offsetHeight))
    beam.setAttribute('width', String(wrap.offsetWidth)); beam.setAttribute('height', String(wrap.offsetHeight))
    base.innerHTML = dim + lit
    beam.innerHTML = beamMarkup
  }, [])

  const focus = {
    enter: (id: string, target?: string) => { hoverRef.current = { id, target }; drawEdges() },
    leave: () => { hoverRef.current = null; drawEdges() },
    go: (id: string) => {
      const element = wrapRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      if (element) { element.dataset.flash = '1'; window.setTimeout(() => { delete element.dataset.flash }, 1300) }
    },
  }

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    drawEdges()
    const started = performance.now()
    const tick = () => { drawEdges(); if (performance.now() - started < 340) frameRef.current = requestAnimationFrame(tick) }
    frameRef.current = requestAnimationFrame(tick)
    const observer = new ResizeObserver(drawEdges)
    observer.observe(wrap)
    wrap.querySelectorAll<HTMLElement>('[data-node-id]').forEach((element) => observer.observe(element))
    return () => { observer.disconnect(); cancelAnimationFrame(frameRef.current) }
  })

  return { wrapRef, baseRef, beamRef, hoverRef, drawEdges, focus }
}
