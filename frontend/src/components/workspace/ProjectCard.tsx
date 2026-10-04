import { useState, useEffect, type FC } from 'react'
import type { ProjectCardVm, ProjectTone } from '../../types/workspace.types'
import { StatusBadge } from '../common/StatusBadge'
import { RoleBadge } from '../common/RoleBadge'
import { Avatar } from '../common/Avatar'

const TONES: Record<ProjectTone, string> = {
  indigo: 'bg-indigo-100 text-indigo-600',
  sky: 'bg-sky-100 text-sky-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  violet: 'bg-violet-100 text-violet-600',
  amber: 'bg-amber-100 text-amber-600',
  slate: 'bg-slate-200 text-slate-500',
}

const BranchIcon: FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className="shrink-0"
    aria-hidden="true"
  >
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="9" r="2" />
    <path d="M6 7v10M18 11c0 4-6 3-12 6" />
  </svg>
)

interface ProjectCardProps {
  p: ProjectCardVm
  index: number
  onOpen: (p: ProjectCardVm) => void
}

export const ProjectCard: FC<ProjectCardProps> = ({ p, index, onOpen }) => {
  const [w, setW] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setW(p.done), 80 + index * 40)
    return () => clearTimeout(timer)
  }, [p.done, index])

  const toneClass = TONES[p.tone] ?? TONES.indigo

  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      style={{ animationDelay: `${index * 40}ms` }}
      className="rise group text-left rounded-2xl border border-slate-200/90 bg-white/95 ring-1 ring-slate-900/[0.03] shadow-sm p-5 flex flex-col gap-3.5 min-h-[220px] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_rgba(99,102,241,0.18)] hover:border-indigo-200/80 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`w-9 h-9 rounded-xl grid place-items-center text-base font-bold select-none ${toneClass}`}
        >
          {p.icon}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <StatusBadge status={p.status} />
          <RoleBadge role={p.role} displayFormat="titlecase" />
        </div>
      </div>

      <div>
        <h3 className="font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
          {p.name}
        </h3>
        <p className="clamp1 text-xs text-slate-500 mt-0.5">{p.desc}</p>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2">
          <BranchIcon />
          <span>
            {p.nodes} nodes · {p.crit} on critical path
          </span>
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex -space-x-1.5">
          {p.members.slice(0, 3).map((m, k) => (
            <Avatar key={m} name={m} index={k} />
          ))}
        </div>
        {p.members.length > 3 && (
          <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
            +{p.members.length - 3}
          </span>
        )}
      </div>

      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-500 font-medium">Completion</span>
          <span className="font-bold text-slate-800">{p.done}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${w}%`,
              background:
                p.done === 100
                  ? '#10b981'
                  : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              transition: 'width 900ms cubic-bezier(.22, 1, .36, 1)',
            }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">{p.upd}</span>
        <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-sm font-bold">
          ↗
        </span>
      </div>
    </button>
  )
}
