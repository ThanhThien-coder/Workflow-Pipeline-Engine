import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import type { MacroPhase } from '../../types/workflow.types'
import { MACRO_CARD_H, MACRO_CARD_W } from '../../utils/macroLayout'
import { phaseDisplayName } from '../../utils/phaseName'
import { useWorkflowStore } from '../../store/useWorkflowStore'

const accentStyles = {
  emerald: { bar: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200', track: 'bg-emerald-400' },
  blue: { bar: 'bg-blue-400', pill: 'bg-blue-50 text-blue-600 border-blue-200', track: 'bg-blue-400' },
  slate: { bar: 'bg-slate-300', pill: 'bg-slate-100 text-slate-400 border-slate-300', track: 'bg-slate-300' },
} as const

export interface PhaseCardProps {
  phase: MacroPhase
  position: { x: number; y: number }
  selected: boolean
  onClick: () => void
  onSpawnDown: (event: React.MouseEvent<HTMLButtonElement>, phaseId: string) => void
  onDragCardStart?: (event: React.MouseEvent, phaseId: string) => void
  onDeletePhase?: (phaseId: string) => void
  /** B5: người không phải owner. Không có nút xóa, cổng nối bị vô hiệu hóa, con trỏ không còn kiểu "kéo". */
  readOnly?: boolean
  /** Lời giải thích hiện trên nút bị vô hiệu hóa khi readOnly. */
  readOnlyTitle?: string
  /** T5: rê chuột vào / ra thẻ, để làm nổi các dây của phase này. */
  onHoverChange?: (hovered: boolean) => void
  /** Lưu tên bị lỗi (ví dụ 403/409): nơi dùng hiện toast. */
  onRenameError?: (error: unknown) => void
}

export function PhaseCard({
  phase,
  position,
  selected,
  onClick,
  onSpawnDown,
  onDragCardStart,
  onDeletePhase,
  readOnly = false,
  readOnlyTitle,
  onHoverChange,
  onRenameError,
}: PhaseCardProps) {
  // Màu chỉ theo trạng thái suy ra từ task (G33): xong -> xanh lá, khóa hoặc chưa có task -> xám, còn lại -> xanh dương
  const accentKey =
    phase.status === 'COMPLETED' ? 'emerald' : phase.status === 'LOCKED' || phase.status === 'NO_TASKS' ? 'slate' : 'blue'
  const accent = accentStyles[accentKey]

  const renamePhase = useWorkflowStore((state) => state.renamePhase)
  const phaseToRename = useWorkflowStore((state) => state.phaseToRename)
  const clearPhaseToRename = useWorkflowStore((state) => state.clearPhaseToRename)
  const displayName = phaseDisplayName(phase)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter rồi blur (hoặc Esc rồi blur) không được xử lý hai lần
  const finished = useRef(false)

  const startEditing = () => {
    if (readOnly || editing) return
    finished.current = false
    setDraft(displayName)
    setEditing(true)
  }

  // Phase vừa tạo bằng (+): tự bật ô nhập tên rồi xóa cờ
  useEffect(() => {
    if (phaseToRename === phase.id && !readOnly) {
      finished.current = false
      setDraft(displayName)
      setEditing(true)
      clearPhaseToRename()
    }
    // displayName chỉ dùng làm giá trị khởi tạo của ô nhập
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseToRename, phase.id, readOnly, clearPhaseToRename])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const finishEditing = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    const next = draft.trim()
    if (save && next && next !== displayName) {
      void Promise.resolve(renamePhase(phase.id, next)).catch((error) => onRenameError?.(error))
    }
  }

  return (
    <div
      data-phase-id={phase.id}
      role="button"
      tabIndex={0}
      onMouseDown={(event) => {
        if (event.button === 0 && !(event.target as HTMLElement).closest('button, a, input')) {
          onDragCardStart?.(event, phase.id)
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: MACRO_CARD_W,
        height: MACRO_CARD_H,
      }}
      className={`group select-none text-left rounded-2xl bg-white border shadow-sm overflow-visible transition-shadow duration-200 ${
        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        selected
          ? 'border-indigo-400 shadow-xl ring-2 ring-indigo-200'
          : 'border-slate-200 hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Top Accent Strip: bọc trong lớp bo góc bằng thẻ (trừ 1px viền) để thanh màu không lòi ra ngoài góc bo */}
      <div data-accent-clip className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]">
        <div className={`h-1.5 w-full ${accent.bar}`} />
      </div>

      {/* Target Connection Handle (Left Port) */}
      <div
        data-target-handle="true"
        data-phase-id={phase.id}
        title="Target port (Drop connection from parent phase here)"
        className="absolute -left-3.5 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white border-2 border-slate-300 shadow-sm text-slate-400 group-hover:border-blue-500 group-hover:text-blue-500 group-hover:shadow transition-all pointer-events-none"
      >
        <ChevronRight size={13} className="ml-0.5" />
      </div>

      {/* Main Content Area */}
      <div className="px-4 pb-4 pt-[22px] h-full flex flex-col pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pr-1">
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') finishEditing(true)
                  else if (event.key === 'Escape') finishEditing(false)
                }}
                onBlur={() => finishEditing(true)}
                aria-label="Phase name"
                className="pointer-events-auto w-full rounded-md border border-indigo-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
              />
            ) : (
              <div className="flex items-center gap-1">
                <div
                  data-phase-name
                  className="pointer-events-auto min-w-0 truncate text-sm font-semibold leading-snug text-slate-800"
                  title={displayName}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    startEditing()
                  }}
                >
                  {displayName}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      startEditing()
                    }}
                    title="Rename phase"
                    aria-label="Rename phase"
                    className="pointer-events-auto shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
            {onDeletePhase && !readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeletePhase(phase.id)
                }}
                title="Delete this phase"
                className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}

            {phase.locked ? (
              <span className="text-slate-300" title="Phase is locked waiting for prerequisite phases">
                <Lock size={17} />
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Inspect phase tasks and graph"
              >
                Click to inspect <ChevronRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${accent.pill}`}>
              {phase.status === 'NO_TASKS' ? 'NO TASKS' : phase.status}
            </span>
            <span className="text-xs font-semibold text-slate-500">{phase.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${accent.track}`}
              style={{ width: `${phase.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Source Connection Handle (Right Port) */}
      <button
        type="button"
        disabled={readOnly}
        onMouseDown={(event) => {
          if (readOnly) {
            event.stopPropagation()
            return
          }
          onSpawnDown(event, phase.id)
        }}
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
        }}
        title={readOnly ? readOnlyTitle : 'Drag to another phase to connect · Or click to quickly create child phase'}
        className={`absolute -right-3.5 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white shadow-md transition-all pointer-events-auto ${
          readOnly
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-110 active:scale-95 cursor-crosshair'
        }`}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
