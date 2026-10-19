import { useState, type FC } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  Kanban,
  Sparkles,
  Share2,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Copy,
  ChevronRight,
  Clock,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import { SmoothTabSwitcher, type TabItem } from './SmoothTabSwitcher'
import { CountUp } from './CountUp'
import {
  editorialStaggerContainer,
  editorialTextReveal,
  badgePop,
  cardParallaxEnter,
} from '../../lib/motion'

const TOUR_TABS: TabItem[] = [
  { id: 'dag', label: 'DAG Graph & Kahn Engine', icon: <GitBranch size={16} /> },
  { id: 'kanban', label: 'Kanban FSM & Review Gate', icon: <Kanban size={16} /> },
  { id: 'ai', label: 'AI Diagnostics & CPM', icon: <Sparkles size={16} /> },
  { id: 'guest', label: 'Guest Gateway & Feedback', icon: <Share2 size={16} /> },
  { id: 'templates', label: 'Template Studio & Presets', icon: <Layers size={16} /> },
]

export const ProductTourSection: FC = () => {
  const [activeTab, setActiveTab] = useState('dag')

  // Tab 1 States (DAG Kahn Engine)
  const [joinPolicy, setJoinPolicy] = useState<'ALL_COMPLETED' | 'ANY_COMPLETED'>('ALL_COMPLETED')
  const [hasSimulatedCycle, setHasSimulatedCycle] = useState(false)

  // Tab 2 States (Kanban FSM)
  const [reviewState, setReviewState] = useState<'REVIEW' | 'DONE' | 'REJECTED'>('REVIEW')

  // Tab 3 States (AI CPM)
  const [activeSprint, setActiveSprint] = useState<'sprint-1' | 'sprint-2'>('sprint-2')

  // Tab 4 States (Guest Feedback)
  const [feedbacks, setFeedbacks] = useState([
    {
      id: 'fb-1',
      author: 'Faculty Advisor (Academic Reviewer)',
      content: 'Please attach API Swagger documentation and JWT rotation specification before final review.',
      status: 'OPEN',
      time: '14:20 Today',
    },
    {
      id: 'fb-2',
      author: 'Technical Lead (Reviewer)',
      content: 'Two-tier Macro Phases and Micro Nodes architecture completely resolves deadlocks!',
      status: 'RESOLVED',
      time: 'Yesterday',
    },
  ])

  // Tab 5 States (Templates)
  const [selectedTemplate, setSelectedTemplate] = useState('sdlc')

  const toggleFeedbackResolved = (id: string) => {
    setFeedbacks((prev) =>
      prev.map((fb) =>
        fb.id === id ? { ...fb, status: fb.status === 'OPEN' ? 'RESOLVED' : 'OPEN' } : fb
      )
    )
  }

  return (
    <section id="dag-engine" className="relative py-20 lg:py-32 bg-[#FBF9F9] overflow-hidden">
      {/* Background radial soft aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(120,86,255,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header with Viewport Trigger */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={editorialStaggerContainer}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            variants={badgePop}
            className="inline-flex items-center gap-2 rounded-full bg-mp-purple-20 px-3.5 py-1 text-xs font-semibold text-mp-purple-150 border border-mp-purple-100/20"
          >
            <Sparkles size={13} className="text-mp-purple-100" />
            <span>ENTERPRISE-GRADE WORKFLOW ENGINE</span>
          </motion.div>
          <motion.h2
            variants={editorialTextReveal}
            className="mt-4 text-3xl font-medium tracking-tight text-mp-ink sm:text-5xl"
          >
            Every core capability engineered for reliability.
          </motion.h2>
          <motion.p
            variants={editorialTextReveal}
            className="mt-4 text-base sm:text-lg text-mp-n-600"
          >
            Discover 100% deadlock prevention, strict state transitions, deterministic performance,
            and AI-assisted governance.
          </motion.p>

          {/* Smooth Tab Switcher Header */}
          <motion.div variants={cardParallaxEnter} className="mt-8 flex justify-center">
            <SmoothTabSwitcher
              tabs={TOUR_TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              layoutId="product-tour-tabs"
            />
          </motion.div>
        </motion.div>

        {/* Tab Content Panels */}
        <div className="mt-12 lg:mt-16">
          <AnimatePresence mode="wait">
            {/* TAB 1: DAG & KAHN ENGINE */}
            {activeTab === 'dag' && (
              <motion.div
                key="tab-dag"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 items-center"
              >
                {/* Left Description */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-mp-purple-20 px-2.5 py-1 text-xs font-mono font-bold text-mp-purple-150">
                    O(V + E) TOPOLOGICAL SORT
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-medium text-mp-ink">
                    Two-Tier DAG &amp; Kahn Topological Engine
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-mp-n-600 leading-relaxed">
                    Model engineering lifecycles hierarchically through <strong>Macro Phases</strong> and{' '}
                    <strong>Micro Nodes</strong>. Native O(V+E) Kahn&apos;s algorithm dynamically computes
                    execution ranks and eliminates circular deadlocks prior to release.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-mp-purple-20 p-1.5 text-mp-purple-150">
                        <GitBranch size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Strict Join Policies: AND &amp; OR Convergence
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Supports <strong>ALL_COMPLETED</strong> (AND-Join: waits for all prerequisite branches)
                          and <strong>ANY_COMPLETED</strong> (OR-Join: triggers as soon as any single branch completes).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-red-100 p-1.5 text-red-600">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Fail-Fast Cycle Detection: HTTP 422 Unprocessable Entity
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Automatically highlights circular dependency edges in red and rejects invalid configurations
                          before persisting to PostgreSQL.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Mock UI */}
                <div className="rounded-3xl border border-mp-n-200 bg-white p-6 shadow-mp-float">
                  {/* Top Engine Banner */}
                  <div className="flex items-center gap-2.5 rounded-2xl bg-mp-purple-20/60 p-3.5 text-xs text-mp-purple-200 border border-mp-purple-100/30">
                    <span className="h-2.5 w-2.5 rounded-full bg-mp-purple-100 animate-pulse-dot shrink-0" />
                    <span className="font-mono">
                      Kahn Topological Validator · Verified 18 Nodes &amp; 24 Edges: 0 Cycles Detected. Ranked Phase 1 → Phase 4.
                    </span>
                  </div>

                  {/* Interactive Controls */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-mp-n-100 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-mp-n-600">Join Policy:</span>
                      <button
                        type="button"
                        onClick={() => setJoinPolicy('ALL_COMPLETED')}
                        className={clsx(
                          'cursor-pointer rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-colors',
                          joinPolicy === 'ALL_COMPLETED'
                            ? 'bg-mp-purple-150 text-white'
                            : 'bg-mp-n-100 text-mp-n-600 hover:bg-mp-n-200'
                        )}
                      >
                        ALL_COMPLETED (AND)
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinPolicy('ANY_COMPLETED')}
                        className={clsx(
                          'cursor-pointer rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-colors',
                          joinPolicy === 'ANY_COMPLETED'
                            ? 'bg-mp-purple-150 text-white'
                            : 'bg-mp-n-100 text-mp-n-600 hover:bg-mp-n-200'
                        )}
                      >
                        ANY_COMPLETED (OR)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHasSimulatedCycle((prev) => !prev)}
                      className={clsx(
                        'cursor-pointer inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
                        hasSimulatedCycle
                          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-mp-purple-100/40 bg-mp-purple-20/40 text-mp-purple-150 hover:bg-mp-purple-20'
                      )}
                    >
                      <RefreshCw size={12} className={hasSimulatedCycle ? 'animate-spin' : ''} />
                      <span>{hasSimulatedCycle ? 'Clear Cycle Simulation' : 'Simulate Circular Dependency'}</span>
                    </button>
                  </div>

                  {/* Graph Canvas Visual */}
                  <div
                    className={clsx(
                      'mt-5 rounded-2xl p-6 transition-all duration-300 border',
                      hasSimulatedCycle
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-mp-n-200 bg-gradient-to-b from-mp-n-50 to-white'
                    )}
                  >
                    {hasSimulatedCycle ? (
                      <div className="space-y-4 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3.5 py-1 text-xs font-bold text-red-700">
                          <AlertTriangle size={14} />
                          HTTP 422: CYCLE_DETECTED — Publication Blocked!
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-red-300 bg-red-100/70 p-3 text-red-800">
                            <span className="font-mono text-xs font-bold">Node A (Auth)</span>
                            <div className="mt-1 text-[11px] text-red-600">Points to Node B</div>
                          </div>
                          <div className="rounded-xl border border-red-300 bg-red-100/70 p-3 text-red-800">
                            <span className="font-mono text-xs font-bold">Node B (Token)</span>
                            <div className="mt-1 text-[11px] text-red-600">Points to Node C</div>
                          </div>
                          <div className="rounded-xl border-2 border-dashed border-red-500 bg-red-200/80 p-3 text-red-900 animate-pulse">
                            <span className="font-mono text-xs font-bold">Node C (Loop to A)</span>
                            <div className="mt-1 text-[11px] text-red-700 font-bold">Cycle Violation!</div>
                          </div>
                        </div>
                        <p className="text-xs text-red-700 font-mono">
                          Kahn&apos;s algorithm detected remaining vertices with In-Degree &gt; 0. Graph cannot be topologically sorted!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-mp-n-600 border-b border-mp-n-100 pb-2">
                          <span>DAG Status: Valid (Acyclic Graph)</span>
                          <span className="font-mono text-[#07B096] font-bold">0 Cycles · Topo Sorted</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          {['Phase 1: Foundation', 'Phase 2: Core FSM', 'Phase 3: Security Gate', 'Phase 4: Release'].map(
                            (phase, idx) => (
                              <div
                                key={phase}
                                className="rounded-xl border border-mp-mint-150/30 bg-white p-3 shadow-xs text-center"
                              >
                                <span className="font-mono text-[10px] uppercase font-bold text-mp-mint-150">
                                  Step {idx + 1}
                                </span>
                                <div className="mt-1 text-xs font-bold text-mp-ink">{phase}</div>
                                <div className="mt-2 text-[10px] text-mp-n-500 font-mono">In-Degree: 0</div>
                              </div>
                            )
                          )}
                        </div>
                        <div className="text-center text-xs text-mp-n-500 font-mono">
                          Active Policy: <strong>{joinPolicy}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: KANBAN FSM & REVIEW GATE */}
            {activeTab === 'kanban' && (
              <motion.div
                key="tab-kanban"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 items-center"
              >
                {/* Left Description */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-mp-amber-40/60 px-2.5 py-1 text-xs font-mono font-bold text-mp-amber-200">
                    5-STATE FINITE STATE MACHINE
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-medium text-mp-ink">
                    5-Stage FSM with Direct Push Delivery
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-mp-n-600 leading-relaxed">
                    Enforce rigorous lifecycle integrity across <code>LOCKED</code> → <code>TODO</code> →{' '}
                    <code>IN_PROGRESS</code> → <code>REVIEW</code> → <code>DONE</code>. Direct Push
                    model hides blocked tasks, serving only unblocked, actionable items to designated contributors.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-mp-purple-20 p-1.5 text-mp-purple-150">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Single-Path Delivery: Strict Dependency Fulfillment
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Contributors only see tasks whose prerequisite graph dependencies are 100% met.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-mp-amber-40/60 p-1.5 text-mp-amber-150">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Mandatory Rejection Reasons: Owner Quality Gate
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Contributors cannot mark tasks DONE directly. Artifact submissions (GitHub PR, Figma, Swagger) require Owner sign-off.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Mock UI */}
                <div className="rounded-3xl border border-mp-n-200 bg-white p-6 shadow-mp-float">
                  {/* Top System Bubble */}
                  <div className="flex items-center gap-2.5 rounded-2xl bg-mp-amber-20/60 p-3.5 text-xs text-mp-amber-200 border border-mp-amber-100/30">
                    <span className="h-2.5 w-2.5 rounded-full bg-mp-amber-100 animate-pulse-dot shrink-0" />
                    <span className="font-mono">
                      Strict Review Gate · Protected by JPA @Version (v4) optimistic locking. Optional artifact submission.
                    </span>
                  </div>

                  {/* Kanban Card Interactive Mock */}
                  <div className="mt-6 rounded-2xl border border-mp-n-200 bg-mp-n-50/60 p-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-mp-n-500">TASK-042 // AUTH MODULE</span>
                      <span
                        className={clsx(
                          'rounded-full px-3 py-0.5 text-xs font-semibold font-mono',
                          reviewState === 'DONE' && 'bg-mp-mint-40/70 text-[#07B096]',
                          reviewState === 'REVIEW' && 'bg-mp-purple-20 text-mp-purple-150',
                          reviewState === 'REJECTED' && 'bg-mp-amber-40/70 text-mp-amber-150'
                        )}
                      >
                        STATUS: {reviewState}
                      </span>
                    </div>

                    <h4 className="mt-3 text-base font-bold text-mp-ink">
                      Implement Rate Limiting on API Gateway
                    </h4>
                    <p className="mt-1 text-xs text-mp-n-600">
                      Artifact: <span className="font-mono text-mp-purple-150 underline">github.com/org/repo/pull/18</span>
                    </p>

                    {/* Rejection Amber Banner if rejected */}
                    {reviewState === 'REJECTED' && (
                      <div className="mt-4 rounded-xl border border-mp-amber-100/70 bg-mp-amber-20/80 p-3.5 text-xs text-mp-amber-200">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle size={14} className="text-mp-amber-150" />
                          <span>Changes Requested (reject_reason):</span>
                        </div>
                        <p className="mt-1 text-mp-n-600">
                          &quot;Add integration tests for refresh token rotation before merging to main branch.&quot;
                        </p>
                      </div>
                    )}

                    {reviewState === 'DONE' && (
                      <div className="mt-4 rounded-xl border border-mp-mint-150/40 bg-mp-mint-40/40 p-3.5 text-xs text-mp-mint-200">
                        <div className="flex items-center gap-1.5 font-bold text-[#07B096]">
                          <CheckCircle2 size={14} />
                          <span>Approved by Project Owner!</span>
                        </div>
                        <p className="mt-1 text-mp-n-600">
                          Downstream dependent tasks received auto-unlock signal and transitioned to <code>TODO</code>.
                        </p>
                      </div>
                    )}

                    {/* Interactive Action Buttons */}
                    <div className="mt-5 flex flex-wrap gap-2 pt-3 border-t border-mp-n-200/80">
                      <button
                        type="button"
                        onClick={() => setReviewState('DONE')}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-mp-mint-150 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-mp-mint-150/90 active:scale-95 transition-all"
                      >
                        <CheckCircle2 size={14} />
                        <span>Approve -&gt; DONE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewState('REJECTED')}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-mp-amber-100 bg-white px-3.5 py-2 text-xs font-bold text-mp-amber-150 shadow-xs hover:bg-mp-amber-20/40 active:scale-95 transition-all"
                      >
                        <AlertTriangle size={14} />
                        <span>Request Changes</span>
                      </button>

                      {reviewState !== 'REVIEW' && (
                        <button
                          type="button"
                          onClick={() => setReviewState('REVIEW')}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-mp-n-500 hover:text-mp-ink"
                        >
                          <RefreshCw size={12} />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: AI DIAGNOSTICS & CPM */}
            {activeTab === 'ai' && (
              <motion.div
                key="tab-ai"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 items-center"
              >
                {/* Left Description */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-mp-purple-20 px-2.5 py-1 text-xs font-mono font-bold text-mp-purple-150">
                    CRITICAL PATH METHOD + GEMINI LLM
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-medium text-mp-ink">
                    Mathematical CPM Combined with Gemini AI
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-mp-n-600 leading-relaxed">
                    Pure deterministic mathematics calculate Critical Path sequences, Early/Late finishes,
                    and zero-slack bottlenecks. Google Gemini LLM evaluates project semantics on-demand to uncover hidden task traps.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-mp-n-200 bg-white p-4 shadow-sm">
                      <div className="text-2xl font-bold text-mp-ink">
                        <CountUp to={94} suffix="%" duration={1.6} />
                      </div>
                      <div className="text-xs text-mp-n-500 mt-0.5">On-Time Velocity</div>
                    </div>
                    <div className="rounded-2xl border border-mp-n-200 bg-white p-4 shadow-sm">
                      <div className="text-2xl font-bold text-mp-purple-150">
                        <CountUp to={0} suffix="h" duration={1.2} />
                      </div>
                      <div className="text-xs text-mp-n-500 mt-0.5">Critical Path Slack</div>
                    </div>
                  </div>
                </div>

                {/* Right Mock UI */}
                <div className="rounded-3xl border border-mp-n-200 bg-white p-6 shadow-mp-float">
                  {/* Top AI Bubble */}
                  <div className="flex items-start gap-2.5 rounded-2xl bg-mp-purple-20/70 p-3.5 text-xs text-mp-purple-200 border border-mp-purple-100/30">
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-mp-purple-100 animate-pulse-dot shrink-0" />
                    <span className="leading-relaxed">
                      <strong>WPE Gemini AI · Task Trap Detected at [WPE-008: Payment Webhook]</strong> — 3 consecutive
                      rejections on critical path. Slack = 0h, risking 2-day delivery slip.
                    </span>
                  </div>

                  {/* Sprint Velocity Bars & Toggle */}
                  <div className="mt-6 flex items-center justify-between border-b border-mp-n-100 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-mp-ink">
                      <span>Delivery Velocity Analysis:</span>
                      <div className="inline-flex rounded-lg bg-mp-n-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveSprint('sprint-1')}
                          className={clsx(
                            'cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors',
                            activeSprint === 'sprint-1' ? 'bg-white shadow-xs text-mp-ink' : 'text-mp-n-500'
                          )}
                        >
                          Sprint 1
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSprint('sprint-2')}
                          className={clsx(
                            'cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors',
                            activeSprint === 'sprint-2' ? 'bg-white shadow-xs text-mp-purple-150' : 'text-mp-n-500'
                          )}
                        >
                          Sprint 2 (Current)
                        </button>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-mp-mint-150 font-semibold">
                      {activeSprint === 'sprint-2' ? '+14% vs baseline' : 'Baseline sprint'}
                    </span>
                  </div>

                  {/* Dynamic Velocity Bars */}
                  <div className="mt-4 flex items-end justify-between gap-3 h-28 pt-4 pb-2 px-2 bg-mp-n-50/50 rounded-xl">
                    {[
                      { label: 'DB Schema', val1: 40, val2: 75, color: 'bg-mp-mint-150' },
                      { label: 'Auth Gateway', val1: 55, val2: 85, color: 'bg-mp-purple-100' },
                      { label: 'CPM Engine', val1: 30, val2: 95, color: 'bg-mp-purple-150' },
                      { label: 'Webhook (Trap)', val1: 65, val2: 35, color: 'bg-red-400' },
                      { label: 'UI Polish', val1: 45, val2: 90, color: 'bg-mp-mint-150' },
                    ].map((col) => {
                      const height = activeSprint === 'sprint-2' ? col.val2 : col.val1
                      return (
                        <div key={col.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <motion.div
                            initial={false}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className={clsx('w-full max-w-[32px] rounded-t-md transition-colors', col.color)}
                          />
                          <span className="text-[10px] text-mp-n-500 truncate w-full text-center">
                            {col.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* CPM Nodes Breakdown */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-red-50/70 border border-red-200/60 p-2.5 text-xs text-red-800">
                      <span className="font-mono font-bold">[CRITICAL] WPE-008: Payment Webhook</span>
                      <span className="font-mono font-semibold">Slack: 0h (Critical Path)</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-mp-mint-40/40 border border-mp-mint-150/30 p-2.5 text-xs text-[#07B096]">
                      <span className="font-mono font-bold">[NON-CRITICAL] WPE-012: Email Notification</span>
                      <span className="font-mono font-semibold">Slack: 16h (Flexible)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: GUEST GATEWAY & FEEDBACK */}
            {activeTab === 'guest' && (
              <motion.div
                key="tab-guest"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 items-center"
              >
                {/* Left Description */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-mp-mint-40/60 px-2.5 py-1 text-xs font-mono font-bold text-mp-mint-200">
                    64-CHAR SHA-256 TOKEN GATEWAY
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-medium text-mp-ink">
                    Instant Guest Access &amp; 1-Way Feedback
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-mp-n-600 leading-relaxed">
                    Share read-only project progress and public deliverables with stakeholders or academic advisors
                    via instant, revocable 64-character SHA-256 tokens—no sign-up required.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-mp-mint-40/60 p-1.5 text-mp-mint-200">
                        <Share2 size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Zero Authentication Friction
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Verified read-only views accessible via single-click secure tokens.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-mp-n-200 bg-white p-3.5 shadow-sm">
                      <div className="mt-0.5 rounded-lg bg-mp-purple-20 p-1.5 text-mp-purple-150">
                        <Clock size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-mp-ink">
                          Focused Feedback Queue: Direct Resolution Flow
                        </h4>
                        <p className="text-xs text-mp-n-600 mt-0.5">
                          Direct 1-way resolution flow (OPEN ➔ RESOLVED) eliminates distracting debates.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Mock UI */}
                <div className="rounded-3xl border border-mp-n-200 bg-white p-6 shadow-mp-float">
                  {/* Top Security Banner */}
                  <div className="flex items-center gap-2.5 rounded-2xl bg-mp-mint-40/50 p-3.5 text-xs text-mp-mint-200 border border-mp-mint-150/30">
                    <span className="h-2.5 w-2.5 rounded-full bg-mp-mint-150 animate-pulse-dot shrink-0" />
                    <span className="font-mono">
                      Guest Share Gateway · 64-char SHA-256 token active in Read-Only Mode.
                    </span>
                  </div>

                  {/* Feedback Cards Interactive List */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-mp-ink px-1">
                      <span>Feedback Queue (Direct Resolution)</span>
                      <span className="text-[11px] font-mono text-mp-n-500">2 Items</span>
                    </div>

                    {feedbacks.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-mp-n-200 bg-mp-n-50/50 p-4 transition-all hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-mp-ink">{item.author}</span>
                          <span
                            className={clsx(
                              'rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono',
                              item.status === 'RESOLVED'
                                ? 'bg-mp-mint-40/70 text-[#07B096]'
                                : 'bg-mp-amber-40/60 text-mp-amber-150'
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-mp-n-600 leading-relaxed">{item.content}</p>

                        <div className="mt-3 flex items-center justify-between border-t border-mp-n-200/70 pt-2.5">
                          <span className="text-[10px] text-mp-n-500">{item.time}</span>
                          <button
                            type="button"
                            onClick={() => toggleFeedbackResolved(item.id)}
                            className={clsx(
                              'cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                              item.status === 'RESOLVED'
                                ? 'bg-mp-n-200 text-mp-n-600 hover:bg-mp-n-300'
                                : 'bg-mp-mint-150 text-white hover:bg-mp-mint-150/90 shadow-xs'
                            )}
                          >
                            <CheckCircle2 size={12} />
                            <span>{item.status === 'RESOLVED' ? 'Reopen' : 'Mark Resolved'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: TEMPLATE STUDIO */}
            {activeTab === 'templates' && (
              <motion.div
                key="tab-templates"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 items-center"
              >
                {/* Left Description */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-mp-purple-20 px-2.5 py-1 text-xs font-mono font-bold text-mp-purple-150">
                    2-TIER WORKFLOW BLUEPRINTS
                  </div>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-medium text-mp-ink">
                    Standardized Blueprint Catalog
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-mp-n-600 leading-relaxed">
                    Kickstart production pipelines in seconds with deep cloning from pre-configured engineering standards.
                    Automatically inherit structured Macro Phases, Micro Nodes, and quality gate configurations.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2 text-xs font-mono text-mp-n-600">
                    <span className="rounded-lg bg-white border border-mp-n-200 px-3 py-1.5 shadow-xs">
                      ⚡ Deep Graph Clone
                    </span>
                    <span className="rounded-lg bg-white border border-mp-n-200 px-3 py-1.5 shadow-xs">
                      🔒 Pre-validated Kahn DAG
                    </span>
                    <span className="rounded-lg bg-white border border-mp-n-200 px-3 py-1.5 shadow-xs">
                      📁 Built-in Artifact Links
                    </span>
                  </div>
                </div>

                {/* Right Mock UI */}
                <div className="rounded-3xl border border-mp-n-200 bg-white p-6 shadow-mp-float">
                  <div className="flex items-center justify-between border-b border-mp-n-100 pb-3">
                    <span className="text-xs font-bold text-mp-ink">Template Catalog · Pre-configured Standards</span>
                    <span className="text-xs text-mp-purple-150 font-medium">3 Blueprints Ready</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      {
                        id: 'sdlc',
                        name: 'Full-Stack Agile SDLC',
                        desc: 'Standard software delivery workflow from 3NF Schema to CI/CD Deploy.',
                        phases: 4,
                        nodes: 18,
                        clones: 342,
                        tag: 'Recommended',
                      },
                      {
                        id: 'cicd',
                        name: 'Microservices CI/CD Pipeline',
                        desc: 'Unit testing, Docker build, security scanning, and Kubernetes staging pipeline.',
                        phases: 5,
                        nodes: 26,
                        clones: 580,
                        tag: 'DevOps',
                      },
                      {
                        id: 'etl',
                        name: 'Data Pipeline ETL & Analytics',
                        desc: 'Data ingestion, cleaning, transformation, and warehouse loading workflow.',
                        phases: 3,
                        nodes: 14,
                        clones: 215,
                        tag: 'Data',
                      },
                    ].map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={clsx(
                          'cursor-pointer rounded-2xl border p-4 transition-all duration-200',
                          selectedTemplate === tpl.id
                            ? 'border-mp-purple-100 bg-mp-purple-20/20 shadow-mp-card ring-2 ring-mp-purple-100/20'
                            : 'border-mp-n-200 bg-white hover:bg-mp-n-50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-mp-ink">{tpl.name}</h4>
                          <span className="rounded-full bg-mp-purple-20 px-2 py-0.5 text-[10px] font-bold text-mp-purple-150">
                            {tpl.tag}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-mp-n-600 line-clamp-1">{tpl.desc}</p>
                        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-mp-n-500 border-t border-mp-n-100/80 pt-2">
                          <span>{tpl.phases} Phases · {tpl.nodes} Nodes</span>
                          <span className="text-mp-purple-150 font-semibold">{tpl.clones} Clones</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
