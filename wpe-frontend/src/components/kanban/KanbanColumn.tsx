import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KanbanTask, TaskStatus, UserSummary } from '../../types/kanban.types'
import { TaskCard } from './TaskCard'

const styles: Record<TaskStatus, { title: string; head: string; badge: string; ring: string }> = {
  TODO: { title: 'To Do', head: 'bg-sky-100 text-sky-800', badge: 'bg-sky-200 text-sky-800', ring: 'ring-sky-300' },
  IN_PROGRESS: { title: 'In Progress', head: 'bg-blue-600 text-white', badge: 'bg-white/25 text-white', ring: 'ring-blue-300' },
  REVIEW: { title: 'In Review', head: 'bg-violet-100 text-violet-800', badge: 'bg-violet-200 text-violet-800', ring: 'ring-violet-300' },
  DONE: { title: 'Done', head: 'bg-emerald-100 text-emerald-800', badge: 'bg-emerald-200 text-emerald-800', ring: 'ring-emerald-300' },
}

const PAGE_SIZE = 4

type ScrollDirection = 'down' | 'up'

type KanbanColumnProps = {
  status: TaskStatus
  tasks: KanbanTask[]
  actor: UserSummary
  pendingIds: string[]
  over: boolean
  onOver: () => void
  onLeave: (event: React.DragEvent<HTMLElement>) => void
  onDrop: (event: React.DragEvent<HTMLElement>) => void
  onMove: (id: string, to: TaskStatus) => void
  onDragStart: (id: string) => void
  dragId: string | null
  filtering: boolean
  onOpenDetails: (task: KanbanTask) => void
}

export function KanbanColumn({ status, tasks, actor, pendingIds, over, onOver, onLeave, onDrop, onMove, onDragStart, dragId, filtering, onOpenDetails }: KanbanColumnProps) {
  const style = styles[status]
  const viewportRef = useRef<HTMLDivElement>(null)
  const isAnimatingRef = useRef(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState<ScrollDirection>('down')
  const [animKey, setAnimKey] = useState(0)

  const pages = useMemo(() => {
    const chunks: KanbanTask[][] = []
    for (let index = 0; index < tasks.length; index += PAGE_SIZE) chunks.push(tasks.slice(index, index + PAGE_SIZE))
    return chunks
  }, [tasks])
  const totalPages = Math.max(1, pages.length)

  // Clamp pageIndex when totalPages shrinks (e.g. after filtering)
  useEffect(() => {
    setPageIndex((previous) => Math.min(previous, Math.max(0, totalPages - 1)))
  }, [totalPages])

  // Navigate page with direction tracking
  const navigatePage = useCallback((dir: 1 | -1) => {
    if (isAnimatingRef.current) return
    const nextDir: ScrollDirection = dir > 0 ? 'down' : 'up'
    setPageIndex((previous) => {
      const next = previous + dir
      if (next < 0 || next >= totalPages) return previous
      return next
    })
    setDirection(nextDir)
    setAnimKey((k) => k + 1)
    isAnimatingRef.current = true
    window.setTimeout(() => {
      isAnimatingRef.current = false
    }, 260)
  }, [totalPages])

  // Native wheel listener for smooth paging
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 15) return
      event.preventDefault()
      if (isAnimatingRef.current) return
      navigatePage(event.deltaY > 0 ? 1 : -1)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [navigatePage])

  const currentPage = pages[pageIndex] ?? []
  const emptySlots = PAGE_SIZE - currentPage.length

  return (
    <section
      onDragOver={(event) => { event.preventDefault(); onOver() }}
      onDragLeave={onLeave}
      onDrop={onDrop}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-slate-100/70 transition ${
        over ? `ring-2 ${style.ring} border-transparent bg-white` : 'border-slate-200'
      }`}
    >
      {/* ── Column Header ── */}
      <header className={`flex shrink-0 items-center justify-between rounded-t-2xl px-4 py-2 ${style.head}`}>
        <div className="flex items-center gap-2">
          <i className={`h-2 w-2 rounded-full ${status === 'IN_PROGRESS' ? 'bg-white' : 'bg-current'}`} />
          <h2 className="text-sm font-bold">{style.title}</h2>
          <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${style.badge}`}>{tasks.length}</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[10px] font-semibold opacity-75">{pageIndex + 1}/{totalPages}</span>
            <button
              type="button"
              aria-label={`Previous page: ${style.title}`}
              disabled={pageIndex === 0}
              onClick={() => navigatePage(-1)}
              className="rounded p-1 transition hover:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Next page: ${style.title}`}
              disabled={pageIndex >= totalPages - 1}
              onClick={() => navigatePage(1)}
              className="rounded p-1 transition hover:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* ── Viewport: Cards container ── */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 relative overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-2.5"
      >
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-400 min-h-[160px]">
            {filtering ? 'No tasks match filter' : 'No tasks yet'}
          </div>
        ) : (
          <div
            key={`${pageIndex}-${animKey}`}
            className="flex flex-col gap-2.5 w-full"
          >
            {currentPage.map((task, index) => {
              // Stagger: scroll-down → bottom-first (3→2→1→0), scroll-up → top-first (0→1→2→3)
              const staggerDelay = direction === 'down'
                ? (3 - index) * 35
                : index * 35

              return (
                <div
                  key={task.id}
                  className={`w-full shrink-0 ${
                    direction === 'down' ? 'animate-cascade-down' : 'animate-cascade-up'
                  }`}
                  style={{ animationDelay: `${staggerDelay}ms` }}
                >
                  <TaskCard
                    task={task}
                    actor={actor}
                    onOpenDetails={onOpenDetails}
                    onDragStart={onDragStart}
                    dragging={dragId === task.id}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
