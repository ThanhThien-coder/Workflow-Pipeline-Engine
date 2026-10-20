import type { FC } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Shield, GitBranch, Cpu, Lock, Layers } from 'lucide-react'
import { useSmoothScroll as useLenis } from '../../motion/SmoothScrollProvider'
import { MagneticButton } from './MagneticButton'
import { useRouter } from '../../router/useRouter'
import {
  editorialStaggerContainer,
  editorialTextReveal,
  badgePop,
  cardParallaxEnter,
} from '../../lib/motion'

export const FooterSection: FC = () => {
  const { navigate } = useRouter()
  const lenis = useLenis()

  const scrollToTop = () => {
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.4, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)) })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const mainContainer = document.querySelector('.landing-scroll-container')
      if (mainContainer) {
        mainContainer.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const scrollToAnchor = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      if (lenis) {
        lenis.scrollTo(el, { offset: -70, duration: 1.2 })
      } else {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <div>
      {/* FINAL CTA BAND WITH EDITORIAL STAGGER */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FBF9F9] via-white to-white py-20 lg:py-28 text-mp-ink border-t border-mp-n-200">
        {/* Breathing ambient glow orb */}
        <motion.div
          aria-hidden="true"
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, #7856FF 0%, #FF8E75 60%, transparent 80%)',
          }}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={editorialStaggerContainer}
          className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center"
        >
          <motion.div
            variants={badgePop}
            className="inline-flex items-center gap-2 rounded-full bg-mp-purple-100/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-mp-purple-150 border border-mp-purple-100/20 backdrop-blur-md"
          >
            <Sparkles size={13} className="text-[#FF8E75]" />
            <span>START WITH WORKFLOW PIPELINE ENGINE</span>
          </motion.div>

          <motion.h2
            variants={editorialTextReveal}
            className="mt-6 text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-mp-ink"
          >
            Orchestrate engineering pipelines{' '}
            <span className="bg-gradient-to-r from-mp-purple-150 via-[#FF8E75] to-mp-coral bg-clip-text text-transparent">
              with zero friction.
            </span>
          </motion.h2>

          <motion.p
            variants={editorialTextReveal}
            className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-mp-n-600 leading-relaxed"
          >
            Experience deterministic workflow governance, state machine integrity, and automated AI diagnostics today.
          </motion.p>

          <motion.div
            variants={cardParallaxEnter}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <MagneticButton
              size="lg"
              variant="primary"
              onClick={() => navigate('/auth?tab=signup')}
              icon={<ArrowRight size={18} />}
            >
              Get Started Free
            </MagneticButton>

            <button
              type="button"
              onClick={() => navigate('/guest')}
              className="cursor-pointer inline-flex items-center gap-2 border border-mp-n-200 bg-white/80 text-mp-ink hover:bg-mp-n-50 hover:border-mp-purple-100/40 text-sm font-medium px-5 py-2.5 rounded-full transition-all shadow-sm backdrop-blur-md"
            >
              <span>Explore Guest Demo</span>
              <span className="text-mp-n-500">→</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToAnchor('architecture')}
              className="cursor-pointer inline-flex items-center gap-2 border border-mp-n-200 bg-white/80 text-mp-ink hover:bg-mp-n-50 hover:border-mp-purple-100/40 text-sm font-medium px-5 py-2.5 rounded-full transition-all shadow-sm backdrop-blur-md"
            >
              <span>View Documentation</span>
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* MEGA FOOTER */}
      <footer className="border-t border-mp-n-200 bg-white py-16 text-mp-ink">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            {/* Col 1: Brand & Identity */}
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={scrollToTop}
                className="cursor-pointer flex items-center gap-2.5 text-left focus:outline-none"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mp-purple-150 text-white shadow-mp-glow">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight text-mp-ink">
                    Workflow Pipeline Engine
                  </span>
                  <div className="text-[10px] font-mono font-semibold text-mp-purple-150 tracking-wider uppercase">
                    DAG &amp; FSM ORCHESTRATOR
                  </div>
                </div>
              </button>

              <p className="mt-4 max-w-sm text-xs sm:text-sm text-mp-n-600 leading-relaxed">
                Two-tier engineering workflow orchestrator (Macro Phases &amp; Micro Nodes).
                100% deadlock prevention via Kahn's algorithm, 5-state lifecycle governance, and AI-assisted CPM bottleneck diagnostics.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs font-mono text-mp-mint-150">
                <span className="h-2 w-2 rounded-full bg-[#07B096] animate-pulse-dot" />
                <span>PostgreSQL 15+ · Flyway V1 Active · JPA @Version Guard</span>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-mp-n-500 font-mono">
                Platform
              </h4>
              <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-mp-n-600">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('dag-engine')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    DAG Orchestration
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('dag-engine')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Kanban FSM
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('dag-engine')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    AI Diagnostics
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/guest')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Guest Gateway
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('dag-engine')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Template Studio
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Architecture */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-mp-n-500 font-mono">
                Architecture
              </h4>
              <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-mp-n-600">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Kahn's Algorithm
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Critical Path Method
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    PostgreSQL 3NF
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Token Rotation
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors text-left"
                  >
                    Clean DI Container
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Resources */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-mp-n-500 font-mono">
                Resources
              </h4>
              <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-mp-n-600">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/auth?tab=signup')}
                    className="cursor-pointer font-medium text-mp-purple-150 hover:underline"
                  >
                    Create New Account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/auth?tab=signin')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors"
                  >
                    System Sign In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/guest')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors"
                  >
                    Guest Read-Only View
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors"
                  >
                    Admin Portal
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAnchor('architecture')}
                    className="cursor-pointer hover:text-mp-purple-150 transition-colors"
                  >
                    Integration Map
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Status */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-mp-n-200 pt-8 text-xs text-mp-n-500">
            <p>
              © 2026 Workflow Pipeline Engine (WPE). All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-mono text-[#07B096]">
                <span className="h-2 w-2 rounded-full bg-[#07B096]" />
                All Systems Operational
              </span>
              <span>·</span>
              <span className="font-mono">Engine v2.4</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
