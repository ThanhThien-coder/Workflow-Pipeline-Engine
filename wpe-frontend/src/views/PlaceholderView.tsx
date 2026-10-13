import type { ReactNode } from 'react'

export function PlaceholderView({ title, breadcrumb, icon, description }: { title: string; breadcrumb: string; icon: ReactNode; description: string }) {
  return <section className="flex h-full min-h-0 flex-col overflow-auto bg-slate-50 p-6 lg:p-8">
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6"><div className="text-xs font-medium text-slate-400">{breadcrumb}</div><div className="mt-1 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600">{icon}</span><h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1></div></div>
      <div className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div className="max-w-md text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div><h2 className="text-lg font-semibold text-slate-700">Tính năng đang hoàn thiện</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p></div></div>
    </div>
  </section>
}
