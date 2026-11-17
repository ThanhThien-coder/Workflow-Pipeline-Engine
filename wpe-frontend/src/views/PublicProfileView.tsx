import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Briefcase, CheckCircle2, ExternalLink, Folder, Github, Globe, Linkedin, Mail, Pencil, Sparkles, UserX } from 'lucide-react'
import { navigate } from '../router/useRouter'
import { profileService } from '../services/container'
import { AvatarImage } from '../components/common/Avatar'
import { ProfileNotFoundError } from '../types/profile.types'
import type { ProfileProjectDto, PublicProfileDto } from '../types/profile.types'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; profile: PublicProfileDto }
  | { status: 'not-found' }
  | { status: 'error' }

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back()
  } else {
    navigate('/workspaces')
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="fixed-ambient-bg" />
      <div className="relative z-10 h-screen overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="ml-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Sparkles size={14} />
            </div>
            <span className="text-sm font-bold text-slate-900">Pipeline Engine</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <main
      className="mx-auto max-w-6xl px-6 py-6"
      role="status"
      aria-live="polite"
      aria-label="Loading profile…"
    >
      <span className="sr-only">Loading profile…</span>
      <div className="flex animate-pulse flex-col gap-6 lg:flex-row">
        <div className="h-96 w-full rounded-2xl border border-slate-200 bg-white lg:w-80" />
        <div className="h-64 flex-1 rounded-2xl border border-slate-200 bg-white" />
      </div>
    </main>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <UserX size={26} />
      </div>
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
      <button
        type="button"
        onClick={goBack}
        className="mt-5 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <ArrowLeft size={14} /> Back
      </button>
    </main>
  )
}

function ProjectRow({ project }: { project: ProfileProjectDto }) {
  const { tasksDone, tasksTotal } = project.stats
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Folder size={16} className="shrink-0 text-indigo-500" />
          <span className="truncate text-sm font-semibold text-slate-900">{project.name}</span>
        </div>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
          {project.role}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{project.phaseLabel}</p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>
            {tasksDone} of {tasksTotal} tasks done
          </span>
          <span>{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${project.name} progress`}
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </li>
  )
}

function ExternalLinkRow({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ExternalLink size={12} className="shrink-0 text-slate-400" />
    </a>
  )
}

function ProfileBody({ p }: { p: PublicProfileDto }) {
  const links = [
    { href: p.links.github, label: 'GitHub', icon: <Github size={15} /> },
    { href: p.links.linkedin, label: 'LinkedIn', icon: <Linkedin size={15} /> },
    { href: p.links.website, label: 'Website', icon: <Globe size={15} /> },
  ].filter((l) => l.href)

  return (
    <main className="mx-auto max-w-6xl px-6 py-6 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full space-y-6 lg:w-80 lg:shrink-0">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col items-center text-center">
              <AvatarImage
                src={p.avatarUrl}
                alt={p.displayName}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-indigo-50"
                fallback={
                  <span
                    title={p.displayName}
                    className="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white ring-4 ring-indigo-50"
                  >
                    {initials(p.displayName)}
                  </span>
                }
              />
              <h1 className="mt-4 text-xl font-bold text-slate-900">{p.displayName}</h1>
              {p.title && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <Briefcase size={13} /> {p.title}
                </p>
              )}
              {p.isSelf && (
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Pencil size={12} /> Edit my profile
                </button>
              )}
            </div>

            {p.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.bio}</p>}

            {p.email && (
              <a
                href={`mailto:${p.email}`}
                className="mt-5 flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-700"
              >
                <Mail size={15} className="shrink-0 text-slate-400" />
                <span className="min-w-0 truncate">{p.email}</span>
              </a>
            )}
          </section>

          {p.stats && (
            <Card title="Activity">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dd className="text-lg font-bold text-slate-900">{p.projects.length}</dd>
                  <dt className="text-[11px] font-medium text-slate-500">Projects</dt>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dd className="text-lg font-bold text-slate-900">{p.stats.tasksDone}</dd>
                  <dt className="text-[11px] font-medium text-slate-500">Tasks done</dt>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dd className="text-lg font-bold text-slate-900">{p.stats.onTimePct}%</dd>
                  <dt className="text-[11px] font-medium text-slate-500">On time</dt>
                </div>
              </dl>
            </Card>
          )}

          {p.skills.length > 0 && (
            <Card title="Skills">
              <ul className="flex flex-wrap gap-1.5">
                {p.skills.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {links.length > 0 && (
            <Card title="Links">
              <div className="-mx-2 space-y-0.5">
                {links.map((l) => (
                  <ExternalLinkRow key={l.label} href={l.href} label={l.label} icon={l.icon} />
                ))}
              </div>
            </Card>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <Card title="Projects" hint={p.isSelf ? 'All your projects.' : 'Projects shared publicly or with you.'}>
            {p.projects.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-sm text-slate-500">
                <CheckCircle2 size={22} className="mb-2 text-slate-300" />
                No projects to show.
              </div>
            ) : (
              <ul className="space-y-3">
                {p.projects.map((proj) => (
                  <ProjectRow key={proj.projectId} project={proj} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function PublicProfileView({ userId }: { userId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    profileService
      .getUserProfile(userId)
      .then((profile) => {
        if (!cancelled) setState({ status: 'ready', profile })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState(err instanceof ProfileNotFoundError ? { status: 'not-found' } : { status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <Shell>
      {state.status === 'loading' && <LoadingSkeleton />}
      {state.status === 'not-found' && (
        <Message title="Profile unavailable" text="This profile is private or doesn't exist." />
      )}
      {state.status === 'error' && (
        <Message title="Something went wrong" text="We couldn't load this profile. Please try again later." />
      )}
      {state.status === 'ready' && <ProfileBody p={state.profile} />}
    </Shell>
  )
}
