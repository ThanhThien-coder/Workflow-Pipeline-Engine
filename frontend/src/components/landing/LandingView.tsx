import type { FC, ReactNode } from 'react'
import { Logo } from '../common/Logo'
import { useViewportSlider } from './useViewportSlider'
import { HeroDag } from './HeroDag'
import { KahnSim } from './KahnSim'
import { ReviewGate } from './ReviewGate'
import { MiniKanban } from './MiniKanban'
import { AiCard } from './AiCard'
import { useRouter } from '../../router/useRouter'

const SEC = 'h-screen w-full shrink-0 relative overflow-hidden'
const WRAP = 'absolute inset-0 flex flex-col justify-center items-center px-6 md:px-12 pt-16 pb-6'

const Eyebrow: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
    {children}
  </div>
)

const Card: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`w-full rounded-2xl border border-slate-200/90 ring-1 ring-slate-900/[0.03] bg-white/95 shadow-sm hover:shadow-[0_20px_45px_-10px_rgba(99,102,241,0.08)] hover:border-indigo-200/80 transition-all duration-300 p-5 ${className}`}
  >
    {children}
  </div>
)

const Copy: FC<{
  eyebrow: string
  title: string
  desc: string
  children?: ReactNode
}> = ({ eyebrow, title, desc, children }) => (
  <div className="max-w-md">
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 className="text-[clamp(1.5rem,4.2vh,2.25rem)] font-extrabold tracking-tight text-slate-900 leading-tight">
      {title}
    </h2>
    <p className="mt-3 text-slate-600 leading-relaxed text-sm">{desc}</p>
    {children}
  </div>
)

export const LandingView: FC = () => {
  const { cur, goTo, sections } = useViewportSlider()
  const { navigate } = useRouter()

  const links: [string, number][] = [
    ['DAG Engine', 1],
    ['Features', 2],
    ['Metrics', 3],
    ['Docs', 4],
  ]

  const metrics: [string, string][] = [
    ['0%', 'Circular Dependencies'],
    ['100%', 'Artifact Verified'],
    ['3 Roles', 'Strict RBAC'],
    ['< 150ms', 'State Evaluation'],
  ]

  return (
    <div className="h-screen overflow-hidden relative">
      {/* Fixed Ambient Background */}
      <div className="fixed-ambient-bg" aria-hidden="true">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Top Navbar */}
      <nav
        className="fixed top-0 inset-x-0 z-50 bg-white/95 border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between backdrop-blur-md"
        style={{ paddingTop: 'calc(.875rem + env(safe-area-inset-top,0px))' }}
      >
        <button
          type="button"
          onClick={() => goTo(0)}
          className="flex items-center gap-2.5 cursor-pointer text-left"
        >
          <Logo />
          <span className="font-bold text-slate-900 text-lg">Pipeline Engine</span>
        </button>

        <div className="hidden md:flex gap-7 text-sm font-medium text-slate-600">
          {links.map(([label, idx]) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(idx)}
              className="hover:text-slate-900 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/auth?tab=signin')}
            className="text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl px-4 py-2 transition-colors"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => navigate('/auth?tab=signup')}
            className="btn-primary-solid text-sm font-semibold text-white rounded-xl px-4 py-2"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Pagination Dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 items-center">
        {sections.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            onClick={() => goTo(i)}
            className="group relative flex justify-center"
          >
            <span
              className={`block w-2.5 rounded-full transition-all duration-300 ${
                i === cur ? 'h-6 bg-indigo-600' : 'h-2.5 bg-slate-300 group-hover:bg-slate-400'
              }`}
            />
            <span className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              {name}
            </span>
          </button>
        ))}
      </div>

      {/* Main Sliding Viewport */}
      <main
        className="relative z-10 w-full h-full hardware-accelerated"
        style={{
          transform: `translate3d(0, -${cur * 100}vh, 0)`,
          transition: 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Section 1: HERO */}
        <section className={SEC}>
          <div className={`${WRAP} ${cur === 0 ? '' : 'is-off'}`}>
            <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.14),transparent_65%)] pointer-events-none" />
            <div className="relative max-w-4xl text-center">
              <div className="inline-flex items-center text-xs font-semibold text-indigo-700 border border-indigo-200/60 bg-indigo-50 rounded-full px-3 py-1">
                ✨ V2.0 Engine Live · Mathematical DAG Execution &amp; Zero State Bypass
              </div>
              <h1 className="mt-[2.2vh] text-[clamp(1.9rem,6.2vh,3.9rem)] font-extrabold tracking-tight text-slate-900 leading-[1.05]">
                Orchestrate Technical Pipelines
                <br />
                <span className="grad-text">with Mathematical Rigor.</span>
              </h1>
              <p className="mt-[2vh] max-w-2xl mx-auto text-slate-600 leading-relaxed text-[clamp(.8rem,2.2vh,1.05rem)]">
                Replace chaotic task boards with an immutable Directed Acyclic Graph engine. Enforce strict review constraints, automated Kahn cycle detection, and AI-driven critical path diagnostics.
              </p>
              <div className="mt-[2.4vh] flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  className="btn-primary-solid text-sm font-semibold text-white rounded-xl px-5 py-2.5"
                >
                  Launch Live Sandbox ➔
                </button>
                <button
                  type="button"
                  onClick={() => goTo(4)}
                  className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-5 py-2.5 transition-colors"
                >
                  📄 View Architecture Spec
                </button>
              </div>
              <div
                className="mt-[3vh] max-w-2xl mx-auto rounded-2xl border border-slate-200/90 bg-white shadow-xl p-3 relative overflow-hidden"
                style={{
                  backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span className="font-mono">pipeline/release-v2.dag</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse2" />
                    engine running
                  </span>
                </div>
                <div style={{ maxHeight: '30vh' }} className="flex justify-center">
                  <div className="w-full" style={{ maxWidth: 'min(100%, 62vh)' }}>
                    <HeroDag />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: KAHN ENGINE */}
        <section className={SEC}>
          <div className={`${WRAP} ${cur === 1 ? '' : 'is-off'}`}>
            <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-10 items-center">
              <Copy
                eyebrow="DAG Engine"
                title="Algorithmic Dependency Governance"
                desc="A DAG removes workflow deadlocks entirely. Every structural change is audited in real time by Kahn's algorithm, blocking infinite dependency cycles before a pipeline is ever published."
              >
                <ol className="mt-4 space-y-2 text-xs text-slate-600 list-decimal list-inside">
                  <li>Count each node&apos;s incoming edges (in-degree).</li>
                  <li>Queue every node with in-degree 0, then peel them off one by one.</li>
                  <li>
                    If visited nodes equal total nodes, the graph is acyclic. Otherwise the remaining nodes form a cycle.
                  </li>
                </ol>
              </Copy>
              <Card>
                <KahnSim />
              </Card>
            </div>
          </div>
        </section>

        {/* Section 3: QUALITY GATES */}
        <section className={SEC}>
          <div className={`${WRAP} ${cur === 2 ? '' : 'is-off'}`}>
            <div className="max-w-5xl w-full">
              <div className="text-center mb-[3vh]">
                <Eyebrow>Execution &amp; Governance</Eyebrow>
                <h2 className="text-[clamp(1.5rem,4.2vh,2.25rem)] font-extrabold tracking-tight text-slate-900">
                  Zero-Bypass Quality Gateways
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
                  Evidence is mandatory before review, and only the Owner can accept work. Tasks are pushed straight to each engineer&apos;s focused board.
                </p>
              </div>
              <div className="mb-3 flex justify-center">
                <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1 text-[11px] font-mono font-semibold text-slate-600 shadow-sm">
                  <span>Pipeline Execution Mode</span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse2" />
                    Strict Gate Active
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-indigo-700">SHA-256 Verified</span>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6 items-start">
                <Card>
                  <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wide mb-3">
                    Submit artifact · Owner approval
                  </div>
                  <ReviewGate />
                </Card>
                <Card>
                  <MiniKanban />
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: AI & METRICS */}
        <section className={SEC}>
          <div className={`${WRAP} ${cur === 3 ? '' : 'is-off'}`}>
            <div className="max-w-4xl w-full space-y-[3vh]">
              <div className="text-center">
                <Eyebrow>AI Telemetry</Eyebrow>
                <h2 className="text-[clamp(1.5rem,4.2vh,2.25rem)] font-extrabold tracking-tight text-slate-900">
                  Predictive Bottleneck Diagnostics
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
                  A background AI engine analyzes the critical path, scans overdue nodes, and recommends resource allocation before the schedule slips.
                </p>
              </div>
              <Card>
                <AiCard />
              </Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metrics.map(([v, l]) => (
                  <div
                    key={l}
                    className="rounded-2xl border border-slate-200/90 ring-1 ring-slate-900/[0.03] bg-white/95 shadow-sm hover:shadow-[0_20px_45px_-10px_rgba(99,102,241,0.08)] hover:border-indigo-200/80 transition-all duration-300 p-4"
                  >
                    <div className="text-2xl font-extrabold grad-text">{v}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-800">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: CTA */}
        <section className={SEC}>
          <div className={`${WRAP} ${cur === 4 ? '' : 'is-off'}`}>
            <div className="relative max-w-3xl w-full overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 py-[7vh] text-center shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,.12),transparent_55%)] pointer-events-none" />
              <h2 className="relative text-[clamp(1.6rem,5vh,2.6rem)] font-extrabold tracking-tight text-slate-900">
                Ready to elevate your engineering delivery?
              </h2>
              <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/auth?tab=signup')}
                  className="btn-primary-solid text-sm font-semibold text-white rounded-xl px-5 py-2.5"
                >
                  Launch Live Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/auth?tab=signin')}
                  className="text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-5 py-2.5 transition-colors"
                >
                  Book Enterprise Demo
                </button>
              </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <Logo />
                © 2026 Pipeline Engine. Strict, graph-based orchestration for engineering teams.
              </span>
              <span>🟢 All Systems Operational · V2.4 Active</span>
            </div>
          </div>
        </section>
      </main>

      {/* Scroll to Top Floating Button (Bottom Center) */}
      <button
        type="button"
        onClick={() => goTo(0)}
        aria-label="Back to top"
        title="Back to top"
        className={`fixed bottom-7 left-1/2 z-40 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 hover:bg-white text-slate-600 hover:text-indigo-600 border border-slate-200/90 ring-1 ring-slate-900/[0.04] shadow-md hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:scale-105 active:scale-95 ${
          cur > 0
            ? 'opacity-100 pointer-events-auto -translate-x-1/2 translate-y-0 scale-100'
            : 'opacity-0 pointer-events-none -translate-x-1/2 translate-y-4 scale-75'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}
