import { useEffect, useState } from 'react'

export const REPORT_SECTIONS = [
  ['s-overview', 'Overview'],
  ['s-schedule', 'Schedule & deadlines'],
  ['s-team', 'Team & proof'],
  ['s-deep', 'Phases & tasks'],
  ['s-feedback', 'Feedback'],
] as const

export function SectionNav() {
  const [active, setActive] = useState<string>(REPORT_SECTIONS[0][0])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        })
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    REPORT_SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-[57px] z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden"
    >
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {REPORT_SECTIONS.map(([id, label], index) => {
          const isActive = active === id
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault()
                setActive(id)
                document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-slate-400">{index + 1}</span> {label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
