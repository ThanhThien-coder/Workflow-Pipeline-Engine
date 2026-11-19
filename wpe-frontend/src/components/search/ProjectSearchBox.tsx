import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent } from 'react'
import { Layers, ListChecks, Search } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { useRouter } from '../../router/useRouter'
import { phaseDetailPath } from '../workflow/PhaseDetailView'
import { searchProject, type SearchResult } from '../../utils/searchProject'

const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || '')

/** Đang gõ trong ô nhập khác (không phải ô tìm này) thì không cướp phím tắt. */
function isTypingElsewhere(target: EventTarget | null, own: HTMLElement | null): boolean {
  const el = target as HTMLElement | null
  if (!el || el === own || typeof el.tagName !== 'string') return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/**
 * Ô tìm trên header của dự án: tìm task (mã, tên, người làm) và phase trên dữ liệu đã có ở store.
 * Chọn task thì mở phase chứa nó và làm nổi task trên cây; chọn phase thì chỉ mở phase.
 */
export const ProjectSearchBox: FC<{ projectId: string }> = ({ projectId }) => {
  const { navigate } = useRouter()
  const macroPhases = useWorkflowStore((state) => state.macroPhases)
  const trees = useWorkflowStore((state) => state.trees)
  const members = useWorkflowStore((state) => state.project.members)
  const currentProjectId = useWorkflowStore((state) => state.currentProjectId)
  const graphStatus = useWorkflowStore((state) => state.graphStatus)
  const loadPhases = useWorkflowStore((state) => state.loadPhases)
  const setHighlightNodeId = useWorkflowStore((state) => state.ui.setHighlightNodeId)

  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const graphForThisProject = currentProjectId === projectId
  const loading = !graphForThisProject || graphStatus === 'loading' || graphStatus === 'idle'
  const hasQuery = query.trim().length >= 1

  // Đồ thị chưa tải cho dự án này thì tải khi bắt đầu gõ (đang tải hoặc đã lỗi thì không gọi lại)
  useEffect(() => {
    if (!hasQuery) return
    if (!graphForThisProject || graphStatus === 'idle') void loadPhases(projectId)
  }, [hasQuery, graphForThisProject, graphStatus, loadPhases, projectId])

  const results = useMemo(
    () => (hasQuery && !loading ? searchProject(query, { macroPhases, trees, members }) : []),
    [hasQuery, loading, query, macroPhases, trees, members],
  )

  // Ctrl/⌘+K: focus ô tìm (trừ khi đang gõ ở ô nhập khác)
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
      if (isTypingElsewhere(event.target, inputRef.current)) return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
      if (inputRef.current?.value.trim()) setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const choose = (result: SearchResult) => {
    navigate(phaseDetailPath(projectId, result.phaseId))
    if (result.kind === 'task') setHighlightNodeId(result.id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (results.length > 0) setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (results.length > 0) setActiveIndex((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      const picked = results[activeIndex]
      if (open && picked) {
        event.preventDefault()
        choose(picked)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && hasQuery

  return (
    <div className="relative hidden sm:block">
      <label className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-400 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100/60 w-48 lg:w-64 focus-within:w-80 transition-all duration-200">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="project-search-results"
          aria-label="Search tasks and phases"
          autoComplete="off"
          value={query}
          placeholder="Search tasks, phases..."
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
        />
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 font-mono shrink-0">
          {IS_MAC ? '⌘K' : 'Ctrl K'}
        </kbd>
      </label>

      {showDropdown && (
        <div
          id="project-search-results"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {loading ? (
            <div className="px-3 py-3 text-xs text-slate-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">No results</div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.kind}-${result.id}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown + preventDefault giữ focus ở ô tìm để onBlur không đóng danh sách trước khi bấm
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(result)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs ${
                  index === activeIndex ? 'bg-indigo-50' : ''
                }`}
              >
                {result.kind === 'task' ? (
                  <ListChecks size={14} className="shrink-0 text-indigo-500" />
                ) : (
                  <Layers size={14} className="shrink-0 text-emerald-500" />
                )}
                {result.kind === 'task' ? (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-800">
                      <span className="mr-1.5 font-mono text-[11px] font-semibold text-slate-500">{result.code}</span>
                      {result.title}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {result.phaseName}
                      {result.assigneeName ? ` · ${result.assigneeName}` : ' · Unassigned'}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-800">{result.name}</div>
                    <div className="text-[11px] text-slate-400">Phase</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectSearchBox
