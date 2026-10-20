import type { FC } from 'react'
import { motion } from 'framer-motion'
import { Cpu, ShieldCheck, Database, Layers, Sparkles, Lock, RefreshCw, CheckCircle2 } from 'lucide-react'
import { MixpanelBentoCard } from './MixpanelBentoCard'
import {
  editorialStaggerContainer,
  editorialTextReveal,
  badgePop,
  cardParallaxEnter,
} from '../../lib/motion'

export const ArchitectureBentoSection: FC = () => {
  return (
    <section id="architecture" className="relative bg-[#FBF9F9] py-24 lg:py-32 overflow-hidden border-t border-mp-n-200">
      {/* Ambient background light accents with subtle breathing float */}
      <motion.div
        aria-hidden="true"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full blur-[100px]"
        style={{
          background: 'radial-gradient(circle, #FF7557 0%, transparent 70%)',
        }}
      />
      <motion.div
        aria-hidden="true"
        animate={{
          scale: [1.05, 1, 1.05],
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute bottom-0 left-10 h-[400px] w-[400px] rounded-full blur-[120px]"
        style={{
          background: 'radial-gradient(circle, #7856FF 0%, transparent 70%)',
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
            className="inline-flex items-center gap-2 rounded-full bg-mp-purple-100/10 px-3.5 py-1 text-xs font-semibold tracking-wide uppercase text-mp-purple-150 border border-mp-purple-100/20 backdrop-blur-md"
          >
            <Cpu size={14} className="text-mp-coral" />
            <span>ENTERPRISE-GRADE ARCHITECTURE</span>
          </motion.div>

          <motion.h2
            variants={editorialTextReveal}
            className="mt-5 text-3xl sm:text-5xl font-medium tracking-tight text-mp-ink"
          >
            Engineered for deterministic execution{' '}
            <span className="bg-gradient-to-r from-mp-purple-150 via-[#7856FF] to-mp-coral bg-clip-text text-transparent">
              and complete data integrity.
            </span>
          </motion.h2>

          <motion.p
            variants={editorialTextReveal}
            className="mt-4 text-base sm:text-lg text-mp-n-600"
          >
            Built on foundational software principles: Clean Architecture,
            deterministic mathematical models, and leak-free state synchronization.
          </motion.p>
        </motion.div>

        {/* Asymmetrical Bento Grid with Staggered Entrance */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={editorialStaggerContainer}
          className="mt-16 grid gap-4 lg:grid-cols-6 lg:gap-6"
        >
          {/* Card 1: Hybrid Deterministic & Gemini AI Engine (col-span-4) */}
          <motion.div variants={cardParallaxEnter} className="lg:col-span-4">
            <MixpanelBentoCard tone="dark">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mp-purple-100/20 text-mp-purple-40 border border-mp-purple-100/30">
                <Cpu size={20} />
              </div>
              <span className="font-mono text-xs text-mp-purple-40 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                DETERMINISTIC ENGINE
              </span>
            </div>

            <h3 className="mt-6 text-xl sm:text-2xl font-semibold text-white">
              Hybrid Mathematical Engine &amp; Gemini AI
            </h3>
            <p className="mt-2 text-sm sm:text-base text-white/70 leading-relaxed">
              Separation of concerns: Graph algorithms (Kahn, CPM) execute in deterministic O(V+E) code
              for <strong className="text-white">100% numerical precision</strong>, while Google Gemini provides
              semantic risk analysis cached in JSONB <code>latest_ai_analysis</code>.
            </p>

            {/* Visual Code Mock Inside Card 1 */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/80">
              <div className="flex items-center justify-between text-[11px] text-white/40 pb-2 border-b border-white/10">
                <span>DeterministicGraphEngine.java</span>
                <span className="text-[#07B096]">✓ ZERO_HALLUCINATION</span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] leading-5">
                <div className="text-mp-purple-40">// 1. Deterministic Kahn DAG Topological Validation</div>
                <div>GraphValidationResult topo = kahnAlgorithm.validate(pipelineGraph);</div>
                <div className="text-mp-purple-40">// 2. CPM Slack Time Calculation</div>
                <div>CpmSchedule schedule = cpmEngine.calculateCriticalPath(pipelineGraph);</div>
                <div className="text-[#FF8E75]">// 3. Cached Gemini Semantic Analysis</div>
                <div>project.setLatestAiAnalysis(geminiClient.diagnoseBottlenecks(schedule));</div>
              </div>
            </div>
          </MixpanelBentoCard>
        </motion.div>

        {/* Card 2: Optimistic Locking & Token Rotation (col-span-2) */}
        <motion.div variants={cardParallaxEnter} className="lg:col-span-2">
          <MixpanelBentoCard tone="dark">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mp-lava-100/20 text-[#FF7557] border border-mp-lava-100/30">
                <ShieldCheck size={20} />
              </div>
              <span className="font-mono text-xs text-[#FF7557] bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                SECURITY &amp; FSM
              </span>
            </div>

            <h3 className="mt-6 text-xl font-semibold text-white">
              Optimistic Locking &amp; Token Rotation
            </h3>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Zero race conditions via JPA <code>@Version</code> locking (HTTP 409). Session revocation
              enforced instantly via user <code>token_version</code> verification on every gateway call.
            </p>

            <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-3.5 text-xs font-mono">
              <div className="flex items-center justify-between text-white/70">
                <span>Concurrency Lock</span>
                <span className="text-[#07B096] font-bold">@Version Active</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>Auth Revocation</span>
                <span className="text-mp-purple-40 font-bold">Instant Revoke</span>
              </div>
            </div>
          </MixpanelBentoCard>
        </motion.div>

        {/* Card 3: 12-Table PostgreSQL 3NF & JSONB (col-span-3) */}
        <motion.div variants={cardParallaxEnter} className="lg:col-span-3">
          <MixpanelBentoCard tone="dark">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mp-mint-100/20 text-[#80E1D9] border border-mp-mint-100/30">
                <Database size={20} />
              </div>
              <span className="font-mono text-xs text-[#80E1D9] bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                DATABASE
              </span>
            </div>

            <h3 className="mt-6 text-xl font-semibold text-white">
              12-Table PostgreSQL 3NF &amp; JSONB
            </h3>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Normalized relational schema for mission-critical relational entities, coupled with
              JSONB columns for flexible pipeline graphs and dynamic UI metadata.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-[#80E1D9] font-bold">3NF</div>
                <div className="text-[10px] text-white/50 mt-0.5">Normalized</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-mp-purple-40 font-bold">Flyway</div>
                <div className="text-[10px] text-white/50 mt-0.5">V1 Migration</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-[#FF8E75] font-bold">JSONB</div>
                <div className="text-[10px] text-white/50 mt-0.5">Flexible UI</div>
              </div>
            </div>
          </MixpanelBentoCard>
        </motion.div>

        {/* Card 4: Zero-Leak Clean Architecture (col-span-3) */}
        <motion.div variants={cardParallaxEnter} className="lg:col-span-3">
          <MixpanelBentoCard tone="dark">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mp-amber-100/20 text-[#F8BC3B] border border-mp-amber-100/30">
                <Layers size={20} />
              </div>
              <span className="font-mono text-xs text-[#F8BC3B] bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                FOUNDATION
              </span>
            </div>

            <h3 className="mt-6 text-xl font-semibold text-white">
              Zero-Leak Clean Architecture
            </h3>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Strict separation between UI components and infrastructure services powered by a centralized
              Dependency Injection (DI) Service Container. Data exchanged via immutable DTO records without
              exposing JPA entities to the API surface.
            </p>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3.5 text-xs font-mono text-white/80">
              <span className="flex items-center gap-1.5 text-[#07B096]">
                <CheckCircle2 size={14} /> Controller
              </span>
              <span className="text-white/40">➔</span>
              <span className="flex items-center gap-1.5 text-mp-purple-40">
                <CheckCircle2 size={14} /> Service
              </span>
              <span className="text-white/40">➔</span>
              <span className="flex items-center gap-1.5 text-[#F8BC3B]">
                <CheckCircle2 size={14} /> Repository
              </span>
            </div>
          </MixpanelBentoCard>
        </motion.div>
      </motion.div>
      </div>
    </section>
  )
}
