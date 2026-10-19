import { useState, type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock, Unlock, ArrowRight, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import clsx from 'clsx'

export const HeroPipelineSimulator: FC = () => {
  const [node2Status, setNode2Status] = useState<'REVIEW' | 'DONE'>('REVIEW')
  const [node3Status, setNode3Status] = useState<'LOCKED' | 'TODO'>('LOCKED')
  const [isApproving, setIsApproving] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const handleApprove = () => {
    if (node2Status === 'DONE') return
    setIsApproving(true)
    setNode2Status('DONE')

    // Simulate DAG edge flow & unlock trigger
    setTimeout(() => {
      setNode3Status('TODO')
      setIsApproving(false)
      setNotification('Auto-Unlock Triggered · All parent dependencies fulfilled for WPE-003.')
      setTimeout(() => setNotification(null), 4500)
    }, 600)
  }

  const handleReset = () => {
    setNode2Status('REVIEW')
    setNode3Status('LOCKED')
    setIsApproving(false)
    setNotification(null)
  }

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.3 } }}
      className="relative mx-auto w-full max-w-5xl rounded-3xl border border-mp-n-200 bg-white p-5 sm:p-7 shadow-mp-float transition-all duration-300"
    >
      {/* Top Window Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-mp-n-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 font-mono text-xs font-semibold text-mp-n-600">
            pipeline_orchestration_canvas.dag
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mp-mint-40/40 px-3 py-1 text-[11px] font-semibold text-mp-mint-200 border border-mp-mint-150/30">
            <span className="h-2 w-2 rounded-full bg-mp-mint-150 animate-pulse-dot" />
            DAG Runtime Active · 0 Cycles
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-mp-n-200 px-3 py-1 text-xs font-medium text-mp-n-600 hover:border-mp-purple-100 hover:text-mp-purple-150 transition-colors"
            title="Reset DAG execution state"
          >
            <RotateCcw size={12} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas & Nodes Layout */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-mp-n-50 to-white p-4 sm:p-8 border border-mp-n-100">
        {/* Subtle grid dots background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#9B9B9B 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* 3 Interactive Nodes Grid */}
        <div className="relative z-10 grid gap-6 md:grid-cols-3 md:gap-8 items-center">
          {/* Node 1: WPE-001 (DONE) */}
          <div className="group relative rounded-2xl border border-mp-mint-150/40 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-mp-n-500">WPE-001</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-mp-mint-40/60 px-2.5 py-0.5 text-xs font-semibold text-[#07B096]">
                <CheckCircle2 size={13} />
                DONE
              </span>
            </div>
            <h4 className="mt-2 text-sm font-bold text-mp-ink">Database 3NF Schema</h4>
            <p className="mt-1 text-xs text-mp-n-600 line-clamp-2">
              12 tables normalized, Flyway v1 migration
            </p>
            <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-mp-n-500 border-t border-mp-n-100 pt-2.5">
              <span>Macro: Phase 1</span>
              <span className="text-mp-mint-150 font-medium">Verified by Owner</span>
            </div>
          </div>

          {/* Node 2: WPE-002 (REVIEW -> DONE) */}
          <div
            className={clsx(
              'group relative rounded-2xl p-5 shadow-sm transition-all duration-300 border',
              node2Status === 'DONE'
                ? 'border-mp-mint-150/40 bg-white hover:shadow-md'
                : 'border-mp-purple-100/60 bg-white shadow-mp-card ring-2 ring-mp-purple-100/20'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-mp-n-500">WPE-002</span>
              {node2Status === 'DONE' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-mp-mint-40/60 px-2.5 py-0.5 text-xs font-semibold text-[#07B096]">
                  <CheckCircle2 size={13} />
                  DONE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-mp-purple-20 px-2.5 py-0.5 text-xs font-semibold text-mp-purple-150">
                  <ShieldCheck size={13} />
                  REVIEW
                </span>
              )}
            </div>
            <h4 className="mt-2 text-sm font-bold text-mp-ink">JWT Rotation Engine</h4>
            <p className="mt-1 text-xs text-mp-n-600 line-clamp-2">
              Dual-token cookie auth &amp; token_version revocation
            </p>

            {/* Approve Button */}
            <div className="mt-4 border-t border-mp-n-100 pt-3">
              {node2Status === 'REVIEW' ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-mp-purple-150 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-mp-purple-100 active:scale-95 transition-all duration-150"
                >
                  <Sparkles size={14} className="animate-spin-360" />
                  <span>Approve &amp; Deliver (Owner Gate)</span>
                </button>
              ) : (
                <div className="flex items-center justify-between text-[11px] font-mono text-mp-n-500">
                  <span>Macro: Phase 2</span>
                  <span className="text-[#07B096] font-semibold">Approved &amp; Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Node 3: WPE-003 (LOCKED -> TODO) */}
          <div
            className={clsx(
              'group relative rounded-2xl p-5 transition-all duration-500 border',
              node3Status === 'TODO'
                ? 'border-blue-300 bg-white shadow-md ring-2 ring-blue-500/20'
                : 'border-dashed border-mp-n-300 bg-mp-n-50/70 text-mp-n-500'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-mp-n-500">WPE-003</span>
              {node3Status === 'TODO' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                  <Unlock size={13} />
                  TODO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-mp-n-200 px-2.5 py-0.5 text-xs font-medium text-mp-n-600">
                  <Lock size={12} />
                  LOCKED
                </span>
              )}
            </div>
            <h4
              className={clsx(
                'mt-2 text-sm font-bold',
                node3Status === 'TODO' ? 'text-mp-ink' : 'text-mp-n-600'
              )}
            >
              API Gateway Integration
            </h4>
            <p className="mt-1 text-xs text-mp-n-500 line-clamp-2">
              Reverse proxy &amp; rate limiting route registry
            </p>

            <div className="mt-4 flex items-center justify-between text-[11px] font-mono border-t border-mp-n-200/80 pt-2.5">
              <span className="text-mp-n-500">ALL_COMPLETED Join Policy</span>
              {node3Status === 'TODO' ? (
                <span className="text-blue-600 font-semibold animate-pulse">Ready for Execution</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <Lock size={10} /> Waiting for WPE-002
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Bézier Flow Connection Indicators */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-mp-n-600">
          <span className="inline-flex items-center gap-1 text-[#07B096]">
            WPE-001 <ArrowRight size={13} />
          </span>
          <span className={node2Status === 'DONE' ? 'text-[#07B096]' : 'text-mp-purple-150'}>
            WPE-002
          </span>
          <span
            className={clsx(
              'inline-flex items-center gap-1 transition-colors duration-300',
              node2Status === 'DONE' ? 'text-blue-600 font-bold' : 'text-mp-n-400'
            )}
          >
            <ArrowRight size={13} /> WPE-003 {node3Status === 'TODO' ? '(Unlocked)' : '(Waiting)'}
          </span>
        </div>
      </div>

      {/* Floating Animated Toast Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 rounded-full bg-mp-eggplant px-5 py-2.5 text-xs font-medium text-white shadow-mp-float border border-mp-purple-100/40"
          >
            <span className="h-2 w-2 rounded-full bg-mp-mint-100 animate-pulse-dot" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
