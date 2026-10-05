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
    const wrapW = wrap.offsetWidth
    const wrapH = wrap.offsetHeight
    const k = wrapW && Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width / wrapW : 1
    const safeK = Number.isFinite(k) && k > 0 ? k : 1

    const elements = [...wrap.querySelectorAll<HTMLElement>('[data-node-id]')]
    const positions = new Map<
      string,
      { left: number; right: number; centerY: number; ghost: boolean }
    >()

    elements.forEach((element) => {
      const nodeId = element.dataset.nodeId
      if (!nodeId) return

      const rect = element.getBoundingClientRect()
      if (
        !Number.isFinite(rect.left) ||
        !Number.isFinite(rect.right) ||
        !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.bottom) ||
        !Number.isFinite(bounds.left) ||
        !Number.isFinite(bounds.top)
      ) {
        return
      }

      const left = (rect.left - bounds.left) / safeK
      const right = (rect.right - bounds.left) / safeK
      const centerY = ((rect.top + rect.bottom) / 2 - bounds.top) / safeK

      // Phòng thủ chống NaN và Infinity
      if (
        Number.isFinite(left) &&
        Number.isFinite(right) &&
        Number.isFinite(centerY) &&
        !isNaN(left) &&
        !isNaN(right) &&
        !isNaN(centerY)
      ) {
        positions.set(nodeId, {
          left,
          right,
          centerY,
          ghost: element.dataset.ghost === '1',
        })
      }
    })

    const hovered = hoverRef.current
    const related: Record<string, 'self' | 'up' | 'down'> = {}
    if (hovered?.id && positions.has(hovered.id)) related[hovered.id] = 'self'

    let dim = ''
    let lit = ''
    let beamMarkup = ''

    elements.forEach((element) => {
      const childId = element.dataset.nodeId
      if (!childId) return
      const child = positions.get(childId)
      if (!child || !element.dataset.parents) return

      element.dataset.parents
        .split(',')
        .filter(Boolean)
        .forEach((parentId) => {
          const parent = positions.get(parentId)

          // NẾU 1 TRONG 2 NODE CHƯA CÓ HOẶC TỌA ĐỘ NaN -> BỎ QUA, KHÔNG VẼ ĐỂ TRÁNH VỠ SVG
          if (!parent || !child) return
          if (
            !Number.isFinite(parent.right) ||
            !Number.isFinite(parent.centerY) ||
            !Number.isFinite(child.left) ||
            !Number.isFinite(child.centerY) ||
            isNaN(parent.right) ||
            isNaN(parent.centerY) ||
            isNaN(child.left) ||
            isNaN(child.centerY)
          ) {
            return
          }

          const startX = parent.right
          const startY = parent.centerY
          const endX = child.left
          const endY = child.centerY

          const dx = Math.max((endX - startX) * 0.5, 48)
          if (!Number.isFinite(dx) || isNaN(dx)) return

          const path = `M${startX} ${startY} C${startX + dx} ${startY} ${endX - dx} ${endY} ${endX} ${endY}`

          // Kiểm tra chuỗi path tuyệt đối không được chứa NaN
          if (path.includes('NaN') || path.includes('undefined')) return

          const direct = element.dataset.primary === parentId
          let mode: 'up' | 'down' | null = null
          if (hovered) {
            if (hovered.target) {
              if (element.dataset.nodeId === hovered.id && parentId === hovered.target)
                mode = 'up'
              else if (parentId === hovered.id && element.dataset.nodeId === hovered.target)
                mode = 'down'
            } else if (element.dataset.nodeId === hovered.id) mode = 'up'
            else if (parentId === hovered.id) mode = 'down'
          }

          if (mode) related[mode === 'up' ? parentId : element.dataset.nodeId!] = mode
          if (!direct && !mode) return

          const ghost = parent.ghost || child.ghost
          if (mode) {
            const up = mode === 'up'
            const markup = `<path d="${path}" fill="none" stroke="${
              up ? '#2563eb' : '#10b981'
            }" stroke-width="2.5" stroke-linecap="round"${
              direct ? '' : ' stroke-dasharray="6 4"'
            } style="filter:drop-shadow(0 0 3px ${
              up ? 'rgba(37,99,235,.65)' : 'rgba(16,185,129,.65)'
            })"/>`
            if (direct) lit += markup
            else beamMarkup += markup
          } else {
            dim += `<path d="${path}" fill="none" stroke="${
              ghost ? '#a5a3d4' : '#cbd5e1'
            }" stroke-width="1.5"${ghost ? ' stroke-dasharray="4 4"' : ''}${
              hovered ? ' opacity=".06"' : ''
            }/>`
          }
        })
    })

    elements.forEach((element) => {
      const rel = element.dataset.nodeId ? related[element.dataset.nodeId] : undefined
      if (rel) element.dataset.rel = rel
      else delete element.dataset.rel
    })

    const svgW = Math.max(wrapW || 0, wrap.scrollWidth || 0, 1000)
    const svgH = Math.max(wrapH || 0, wrap.scrollHeight || 0, 600)
    base.setAttribute('width', String(svgW))
    base.setAttribute('height', String(svgH))
    beam.setAttribute('width', String(svgW))
    beam.setAttribute('height', String(svgH))
    base.innerHTML = dim + lit
    beam.innerHTML = beamMarkup
  }, [])

  const focus = {
    enter: (id: string, target?: string) => {
      if (hoverRef.current?.id === id && hoverRef.current?.target === target) return
      hoverRef.current = { id, target }
      drawEdges()
    },
    leave: () => {
      if (!hoverRef.current) return
      hoverRef.current = null
      drawEdges()
    },
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
