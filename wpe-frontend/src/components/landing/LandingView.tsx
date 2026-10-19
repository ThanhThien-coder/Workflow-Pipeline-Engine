import { type FC } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { Sparkles, ArrowRight, Eye } from 'lucide-react'
import { useRouter } from '../../router/useRouter'
import {
  editorialTextReveal,
  editorialStaggerContainer,
  badgePop,
  cardParallaxEnter,
} from '../../lib/motion'
import {
  SmoothScrollProvider,
  useSmoothScrollContext,
} from '../../motion/SmoothScrollProvider'
import { MagneticButton } from './MagneticButton'
import { HeroPipelineSimulator } from './HeroPipelineSimulator'
import { ProductTourSection } from './ProductTourSection'
import { ArchitectureBentoSection } from './ArchitectureBentoSection'
import { StatsRibbonSection } from './StatsRibbonSection'
import { FooterSection } from './FooterSection'

const LandingContent: FC = () => {
  const { navigate } = useRouter()
  const { scrollTo } = useSmoothScrollContext()

  const scrollToSection = (id: string) => {
    scrollTo(`#${id}`, { offset: -70 })
  }

  const scrollToTop = () => {
    scrollTo(0, { duration: 1.25 })
  }

  return (
    <div className="relative min-h-screen">
      {/* Editorial Scroll Progress Bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none bg-black/5"
      >
        <div
          id="editorial-scroll-progress"
          className="h-full bg-gradient-to-r from-mp-purple-150 via-[#7856FF] to-mp-coral transition-transform duration-75 origin-left will-change-transform"
          style={{ transform: 'scaleX(var(--scroll-progress, 0))' }}
        />
      </div>

      {/* ====================================================================
          SECTION 1: STICKY GLASS NAVBAR
          ==================================================================== */}
      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-40 border-b border-mp-n-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={scrollToTop}
              className="cursor-pointer flex items-center gap-2 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mp-purple-150 text-white shadow-mp-glow">
                <Sparkles size={18} />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-mp-ink">
                  Workflow Pipeline Engine
                </span>
                <div className="text-[10px] font-mono font-semibold text-mp-purple-150 tracking-wider uppercase">
                  V2.4 DAG ORCHESTRATOR
                </div>
              </div>
            </button>
          </div>

          {/* Smooth Anchor Navigation with Lenis glides */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-mp-n-600">
            <button
              type="button"
              onClick={() => scrollToSection('dag-engine')}
              className="cursor-pointer hover:text-mp-ink transition-colors"
            >
              DAG Graph
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('dag-engine')}
              className="cursor-pointer hover:text-mp-ink transition-colors"
            >
              Kanban FSM
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('dag-engine')}
              className="cursor-pointer hover:text-mp-ink transition-colors"
            >
              AI Diagnostics
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('dag-engine')}
              className="cursor-pointer hover:text-mp-ink transition-colors"
            >
              Guest Access
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('architecture')}
              className="cursor-pointer hover:text-mp-ink transition-colors"
            >
              Architecture
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/guest')}
              className="cursor-pointer hidden sm:inline-flex items-center gap-1.5 rounded-full border border-mp-n-200 px-3.5 py-2 text-xs font-semibold text-mp-n-600 hover:border-mp-purple-100 hover:text-mp-purple-150 hover:bg-mp-n-50 transition-colors"
            >
              <Eye size={13} />
              <span>Guest View</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/auth?tab=signin')}
              className="cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold text-mp-ink hover:bg-mp-n-100 transition-colors"
            >
              Sign In
            </button>

            <MagneticButton
              size="sm"
              variant="primary"
              onClick={() => navigate('/auth?tab=signup')}
              icon={<ArrowRight size={14} />}
            >
              Get Started →
            </MagneticButton>
          </div>
        </div>
      </header>

      {/* ====================================================================
          SECTION 2: HERO SECTION + INTERACTIVE LIVE PIPELINE SIMULATOR
          ==================================================================== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Subtle Ambient Radial Lighting with Floating Motion */}
        <motion.div
          aria-hidden="true"
          animate={{
            y: [0, -18, 0],
            scale: [1, 1.05, 1],
            opacity: [0.35, 0.45, 0.35],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(120,86,255,0.22) 0%, rgba(255,117,87,0.12) 40%, transparent 70%)',
          }}
        />

        <motion.div
          variants={editorialStaggerContainer}
          initial="hidden"
          animate="visible"
          className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center"
        >
          {/* Kicker Badge */}
          <motion.div variants={badgePop} className="inline-flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-mp-purple-20 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase text-mp-purple-150 border border-mp-purple-100/20 shadow-xs">
              <Sparkles size={13} className="text-mp-purple-100" />
              WORKFLOW PIPELINE ENGINE · DAG &amp; STATE MACHINE ORCHESTRATOR
            </span>
          </motion.div>

          {/* H1 Heading with Editorial Elevation */}
          <motion.h1
            variants={editorialTextReveal}
            className="mt-6 text-[40px] leading-[1.08] sm:text-[54px] lg:text-[72px] font-medium tracking-[-0.03em] text-mp-ink max-w-5xl mx-auto"
          >
            Orchestrate engineering workflows{' '}
            <span className="bg-gradient-to-r from-mp-purple-150 via-[#7856FF] to-mp-coral bg-clip-text text-transparent">
              with architectural precision.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={editorialTextReveal}
            className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-7 sm:leading-8 text-mp-n-600"
          >
            Design two-tier pipelines (Macro Phases &amp; Micro Nodes), prevent circular deadlocks
            via Kahn&apos;s algorithm, enforce quality gates through 5-state FSM, and diagnose
            bottlenecks in real time with AI.
          </motion.p>

          {/* 2 CTA Buttons */}
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
              Launch Workspace →
            </MagneticButton>

            <button
              type="button"
              onClick={() => navigate('/guest')}
              className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-mp-n-300 bg-white px-7 py-3.5 sm:px-8 sm:py-4 text-base font-semibold text-mp-ink hover:border-mp-purple-100 hover:bg-mp-n-50 transition-colors shadow-xs"
            >
              <span>Explore Guest Demo</span>
              <span className="text-mp-purple-150 font-bold">→</span>
            </button>
          </motion.div>

          {/* Interactive Hero Mock UI with Depth Elevation */}
          <motion.div variants={cardParallaxEnter} className="mt-14 lg:mt-16">
            <HeroPipelineSimulator />
          </motion.div>
        </motion.div>
      </section>

      {/* ====================================================================
          SECTION 3: PRODUCT TOUR (5 TABS INTERACTIVE)
          ==================================================================== */}
      <ProductTourSection />

      {/* ====================================================================
          SECTION 4: CORE ARCHITECTURE BENTO GRID
          ==================================================================== */}
      <ArchitectureBentoSection />

      {/* ====================================================================
          SECTION 5: BUSINESS & ENGINEERING STATS RIBBON (COUNTUP)
          ==================================================================== */}
      <StatsRibbonSection />

      {/* ====================================================================
          SECTION 6: FINAL CTA & MEGA FOOTER
          ==================================================================== */}
      <FooterSection />
    </div>
  )
}

export const LandingView: FC = () => {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScrollProvider>
        <LandingContent />
      </SmoothScrollProvider>
    </MotionConfig>
  )
}

export default LandingView

