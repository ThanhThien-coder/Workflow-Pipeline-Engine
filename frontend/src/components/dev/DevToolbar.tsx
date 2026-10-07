import { useEffect, useState } from 'react'
import { AlertOctagon, Check, ChevronDown, ChevronUp, RefreshCw, X, Zap } from 'lucide-react'
import { useWorkflowStore } from '../../store/useWorkflowStore'
import { DEV_PERSONAS } from '../../store/slices/devSlice'
import type { ProjectStatus } from '../../types/settings.types'
import { useRouter } from '../../router/useRouter'


const STATUSES: { id: ProjectStatus; label: string; activeClass: string }[] = [
  { id: 'DRAFT', label: 'DRAFT', activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/60' },
  { id: 'ACTIVE', label: 'ACTIVE', activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60' },
  { id: 'INACTIVE', label: 'INACTIVE', activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/60' },
  { id: 'ARCHIVED', label: 'ARCHIVED', activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/60' },
]

export function DevToolbar() {
  const { pathname, navigate } = useRouter()
  const {
    currentPersonaId,
    simulateCycle,
    latencyMs,
    isFakeError500,
    isOpen,
    switchDevPersona,
    setDevProjectStatus,
    setDevSimulateCycle,
    setDevLatency,
    setDevFakeError,
    resetDevMockData,
    toggleDevToolbar,
  } = useWorkflowStore((state) => state.dev)


  const currentProjectStatus = useWorkflowStore((state) => state.settings.settings?.status || 'DRAFT')
  const currentRole = useWorkflowStore((state) => state.settings.settings?.myRole || state.settings.simulatedRole || 'OWNER')

  const [isResetting, setIsResetting] = useState(false)

  // Keyboard shortcut: Ctrl + Shift + D or Cmd + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        toggleDevToolbar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleDevToolbar])

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await resetDevMockData()
    } finally {
      setIsResetting(false)
    }
  }

  const handleLatencyChange = (value: string) => {
    if (value === '500') {
      setDevFakeError(true)
    } else {
      setDevFakeError(false)
      setDevLatency(Number(value))
    }
  }

  const currentLatencyValue = isFakeError500 ? '500' : String(latencyMs)

  return (
    <>
      {/* ── 1. Floating Pill Toggle Button ── */}
      <button
        type="button"
        onClick={toggleDevToolbar}
        title="Toggle DevToolbar (Ctrl+Shift+D)"
        className={`fixed bottom-4 right-4 z-[999] flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-3.5 py-1.5 font-mono text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all select-none hover:bg-slate-900 ${
          isOpen ? 'ring-2 ring-indigo-500/80 shadow-indigo-500/20' : ''
        }`}
      >
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-bold text-slate-300">DEV</span>
        <span className="text-slate-500">|</span>
        <span className="text-indigo-300">{currentRole}</span>
        <span className="text-slate-500">|</span>
        <span
          className={`font-bold ${
            currentProjectStatus === 'ACTIVE'
              ? 'text-emerald-400'
              : currentProjectStatus === 'DRAFT'
              ? 'text-amber-400'
              : currentProjectStatus === 'INACTIVE'
              ? 'text-orange-400'
              : 'text-rose-400'
          }`}
        >
          {currentProjectStatus}
        </span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-slate-400" />
        ) : (
          <ChevronUp className="h-3 w-3 text-slate-400" />
        )}
      </button>

      {/* ── 2. Expanded Control Popover ── */}
      {isOpen && (
        <div className="fixed bottom-14 right-4 z-[999] w-88 max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-700/90 bg-slate-900/95 p-4 text-xs font-sans text-slate-200 shadow-2xl backdrop-blur-md animate-pop-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-indigo-600/30 text-indigo-400">
                <Zap size={14} />
              </div>
              <div>
                <h3 className="font-bold text-white">Dev & Scenario Toolbar</h3>
                <p className="text-[10px] text-slate-400 font-mono">Zero Coupling · Shortcut: Ctrl+Shift+D</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDevToolbar}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {/* Section 1: Active Persona & Role */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Persona</span>
              <span className="text-[10px] text-indigo-400 font-mono">RBAC Sync</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEV_PERSONAS.map((persona) => {
                const isActive = currentPersonaId === persona.id
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => void switchDevPersona(persona.id)}
                    className={`flex items-center gap-1.5 rounded-lg border p-2 text-left transition-all ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-600/25 text-white shadow-sm ring-1 ring-indigo-500/50'
                        : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{persona.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-[11px] leading-tight">{persona.name}</div>
                      <div className="truncate text-[10px] text-slate-400">{persona.role}</div>
                    </div>
                    {isActive && <Check className="h-3 w-3 shrink-0 text-indigo-400" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Project Lifecycle Status */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Project Status
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1 font-mono text-[10px]">
              {STATUSES.map((st) => {
                const isCurrent = currentProjectStatus === st.id
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => void setDevProjectStatus(st.id)}
                    className={`rounded py-1 font-bold transition-all ${
                      isCurrent
                        ? `border ${st.activeClass} shadow-xs`
                        : 'border border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 3: Chaos & Scenario Flags */}
          <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chaos Testing</span>

            {/* Kahn cycle toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 px-2.5 py-1.5 transition hover:bg-slate-800">
              <div className="flex items-center gap-2">
                <AlertOctagon className={`h-3.5 w-3.5 ${simulateCycle ? 'text-red-400' : 'text-slate-400'}`} />
                <span className="text-[11px] font-medium text-slate-300">Simulate Kahn Cycle Error</span>
              </div>
              <input
                type="checkbox"
                checked={simulateCycle}
                onChange={(e) => setDevSimulateCycle(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Network Latency Selector */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-slate-300">Network Latency</span>
              <select
                value={currentLatencyValue}
                onChange={(e) => handleLatencyChange(e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-200 outline-none transition focus:border-indigo-500"
              >
                <option value="0">0ms (Instant)</option>
                <option value="150">150ms (Normal)</option>
                <option value="500">500ms (Slow 3G)</option>
                <option value="1200">1200ms (High Latency)</option>
                <option value="500" className="text-red-400">
                  Fake 500 Error
                </option>
              </select>
            </div>
          </div>

          {/* Section 4: Quick Actions */}
          <div className="border-t border-slate-800/80 pt-2.5 space-y-1.5">
            <button
              type="button"
              disabled={isResetting}
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-1.5 font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'Resetting Data...' : 'Reset All Mock Data'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (pathname.startsWith('/admin')) {
                  navigate('/workspaces')
                } else {
                  navigate('/admin')
                }
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-700/60 bg-indigo-900/40 py-1.5 font-semibold text-indigo-200 transition hover:bg-indigo-800/60 hover:text-white"
            >
              <span>
                {pathname.startsWith('/admin')
                  ? '📁 Switch to Workspaces (/workspaces)'
                  : '🛡 Switch to Admin Portal (/admin)'}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

