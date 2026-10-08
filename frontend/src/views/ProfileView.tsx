import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { AlertCircle, ArrowLeft, Camera, Check, Folder, Lock, Shield, Sparkles, Trash2, User, X } from 'lucide-react'
import { profileService } from '../services/container'
import { navigate } from '../router/useRouter'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { ProfileError } from '../types/profile.types'
import type { ProfileDto, ProfileErrorCode, ProfileVisibility } from '../types/profile.types'

const ERR: Record<ProfileErrorCode, string> = {
  VALIDATION: 'Please check your input: name 2-60 chars, valid email, bio up to 280, up to 12 skills.',
  FILE_TOO_LARGE: 'Image must be 2 MB or smaller.',
  UNSUPPORTED_TYPE: 'Use a PNG, JPG or WebP image.',
  INVALID_PASSWORD: 'Current password is incorrect.',
  WEAK_PASSWORD: 'New password needs at least 8 characters and a number.',
  INVALID_LINK: 'Please provide valid URLs. GitHub and LinkedIn must use their respective domains.',
  CONFIRMATION_MISMATCH: 'Confirmation text does not match.',
}
const VIS: { value: ProfileVisibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Only me', hint: 'Nobody else can open your profile' },
  { value: 'members', label: 'Project members', hint: 'People who share a project with you' },
  { value: 'public', label: 'Anyone with the link', hint: 'Shows only your public projects' },
]
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
const errText = (e: unknown) => (e instanceof ProfileError ? ERR[e.code] : 'Something went wrong. Please try again.')

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rise rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-indigo-600' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export default function ProfileView() {
  const syncUserAvatar = useWorkflowStore((state) => state.auth.syncUserAvatar)
  const [p, setP] = useState<ProfileDto | null>(null)
  const [form, setForm] = useState({ displayName: '', title: '', email: '', bio: '', skills: [] as string[], links: { github: '', linkedin: '', website: '' } })
  const [skill, setSkill] = useState('')
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' })

  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'projects' | 'account'>('profile')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 3500)
      return () => clearTimeout(t)
    }
  }, [notice])

  const loadForm = (d: ProfileDto) => {
    setP(d)
    setForm({ displayName: d.displayName, title: d.title, email: d.email, bio: d.bio, skills: [...d.skills], links: { ...d.links } })
  }

  useEffect(() => {
    profileService.getMyProfile().then(loadForm).catch((e) => setNotice({ ok: false, text: errText(e) }))
  }, [])

  const run = async (key: string, fn: () => Promise<void>, okText: string) => {
    setBusy(key)
    setNotice(null)
    try {
      await fn()
      setNotice({ ok: true, text: okText })
    } catch (e) {
      setNotice({ ok: false, text: errText(e) })
    } finally {
      setBusy(null)
    }
  }

  if (!p) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center">
          {notice ? <p className="text-sm text-red-700">{notice.text}</p> : <div className="animate-spin-360 h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600" />}
        </div>
      </Shell>
    )
  }

  const dirty = form.displayName !== p.displayName || form.title !== p.title || form.email !== p.email || form.bio !== p.bio ||
    form.skills.join('|') !== p.skills.join('|') ||
    form.links.github !== p.links.github || form.links.linkedin !== p.links.linkedin || form.links.website !== p.links.website

  const totalDone = p.projects.reduce((n, x) => n + x.stats.tasksDone, 0)
  const totalTasks = p.projects.reduce((n, x) => n + x.stats.tasksTotal, 0)
  const onTime = p.projects.length ? Math.round(p.projects.reduce((n, x) => n + x.stats.onTimePct, 0) / p.projects.length) : 0

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      void run('avatar', async () => {
        const nextProfile = await profileService.uploadAvatar(file)
        setP(nextProfile)
        syncUserAvatar(nextProfile.avatarUrl)
      }, 'Profile photo updated')
    }
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    void run('save', async () => loadForm(await profileService.updateProfile(form)), 'Profile saved')
  }
  const addSkill = () => {
    const s = skill.trim()
    if (s && s.length <= 24 && form.skills.length < 12 && !form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) setForm({ ...form, skills: [...form.skills, s] })
    setSkill('')
  }
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addSkill() }
  }
  const changePw = (e: FormEvent) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) return setNotice({ ok: false, text: 'New password and confirmation do not match.' })
    void run('pw', async () => { await profileService.changePassword({ currentPassword: pw.cur, newPassword: pw.next }); setPw({ cur: '', next: '', confirm: '' }) }, 'Password updated')
  }
  const togglePublic = (id: string, v: boolean) =>
    void run('proj:' + id, async () => {
      const u = await profileService.setProjectPublic(id, v)
      setP({ ...p, projects: p.projects.map((x) => (x.projectId === id ? u : x)) })
    }, v ? 'Project is now public' : 'Project is now private')

  const setPrivacy = (patch: Partial<ProfileDto['privacy']>) =>
    void run('privacy', async () => setP({ ...p, privacy: await profileService.updatePrivacy({ ...p.privacy, ...patch }) }), 'Privacy settings updated')

  const deactivateAccount = () => void run('deactivate', async () => { await profileService.deactivateAccount(); navigate('/') }, 'Account deactivated')
  const deleteAccount = () => void run('delete', async () => { await profileService.deleteAccount({ confirmation: 'DELETE' }); navigate('/') }, 'Account deleted')

  return (
    <Shell>
      {notice && (
        <div className={clsx('fixed bottom-6 right-6 z-50 flex animate-in slide-in-from-bottom-5 items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur', notice.ok ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800' : 'border-red-200 bg-red-50/95 text-red-800')}>
          {notice.ok ? <Check size={16} /> : <AlertCircle size={16} />} {notice.text}
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
        <button onClick={() => navigate('/workspaces')} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"><ArrowLeft size={14} /> Back</button>
        <div className="ml-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white"><Sparkles size={14} /></div><span className="text-sm font-bold text-slate-900">Pipeline Engine</span></div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 pb-20">
        <h1 className="text-2xl font-bold text-slate-900">My profile</h1>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full lg:w-64">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {[
                { id: 'profile', label: 'General Profile', Icon: User },
                { id: 'projects', label: 'Projects & Privacy', Icon: Folder },
                { id: 'account', label: 'Account & Security', Icon: Shield },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id as 'profile' | 'projects' | 'account')}
                  className={clsx(
                    'flex min-w-[180px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors lg:min-w-0',
                    activeTab === id
                      ? 'border-indigo-200 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <Icon size={16} className={activeTab === id ? 'text-white' : 'text-slate-500'} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            {activeTab === 'profile' && (
              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
                <div className="space-y-6">
                  <Card title="Identity">
                    <div className="flex flex-col items-center text-center">
                      <div onClick={() => !busy && fileRef.current?.click()} className={clsx('group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full shadow ring-4 ring-white', busy === 'avatar' && 'opacity-50 pointer-events-none')}>
                        {p.avatarUrl
                          ? <img src={p.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                          : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold text-white">{initials(p.displayName)}</div>}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="text-white" size={24} />
                        </div>
                      </div>
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />

                      <div className="mt-3 flex h-7 items-center gap-2">
                        {p.avatarUrl && <button type="button" disabled={busy === 'avatar'} onClick={() => void run('avatar', async () => {
                          const nextProfile = await profileService.removeAvatar()
                          setP(nextProfile)
                          syncUserAvatar(nextProfile.avatarUrl)
                        }, 'Photo removed')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><Trash2 size={13} /> Remove</button>}
                        {!p.avatarUrl && <span className="text-[11px] text-slate-400">PNG, JPG or WebP, up to 2 MB</span>}
                      </div>

                      <h3 className="mt-4 text-lg font-bold text-slate-900">{p.displayName}</h3>
                      <p className="text-sm text-slate-500">{p.title || 'No title yet'}</p>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                      <div><div className="text-lg font-bold text-slate-900">{p.projects.length}</div><div className="text-[11px] text-slate-500">Projects</div></div>
                      <div><div className="text-lg font-bold text-slate-900">{totalDone}/{totalTasks}</div><div className="text-[11px] text-slate-500">Tasks done</div></div>
                      <div><div className="text-lg font-bold text-emerald-600">{onTime}%</div><div className="text-[11px] text-slate-500">On time</div></div>
                    </div>
                  </Card>
                </div>

                <Card title="Personal info">
                  <form onSubmit={save} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Display name"><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={60} className={inputCls} /></Field>
                      <Field label="Job title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} placeholder="e.g. Backend Developer" className={inputCls} /></Field>
                    </div>
                    <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
                    <Field label={`Bio (${form.bio.length}/280)`}><textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={280} rows={3} className={clsx(inputCls, 'resize-none')} /></Field>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="GitHub URL"><input value={form.links.github} onChange={(e) => setForm({ ...form, links: { ...form.links, github: e.target.value } })} className={inputCls} placeholder="https://github.com/..." /></Field>
                      <Field label="LinkedIn URL"><input value={form.links.linkedin} onChange={(e) => setForm({ ...form, links: { ...form.links, linkedin: e.target.value } })} className={inputCls} placeholder="https://linkedin.com/in/..." /></Field>
                      <Field label="Website"><input value={form.links.website} onChange={(e) => setForm({ ...form, links: { ...form.links, website: e.target.value } })} className={inputCls} placeholder="https://..." /></Field>
                    </div>

                    <Field label="Skills">
                      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 p-2">
                        {form.skills.map((s) => (
                          <span key={s} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{s}<button type="button" aria-label={`Remove ${s}`} onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}><X size={12} /></button></span>
                        ))}
                        <input value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={onSkillKey} onBlur={addSkill} maxLength={24} placeholder={form.skills.length < 12 ? 'Type a skill, press Enter' : 'Limit reached'} disabled={form.skills.length >= 12} className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none" />
                      </div>
                    </Field>
                    <div className="flex items-center gap-3">
                      <button type="submit" disabled={!dirty || busy === 'save'} className="btn-primary-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
                      {dirty && <button type="button" onClick={() => loadForm(p)} className="text-xs font-medium text-slate-500 hover:text-indigo-600">Discard</button>}
                    </div>
                  </form>
                </Card>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <Card title="Privacy" hint="Control who can see your profile">
                  <div className="space-y-2">
                    {VIS.map((v) => (
                      <button key={v.value} type="button" disabled={busy === 'privacy'} onClick={() => setPrivacy({ visibility: v.value })}
                        className={clsx('w-full rounded-lg border px-3 py-2 text-left', p.privacy.visibility === v.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50')}>
                        <div className="text-sm font-semibold text-slate-800">{v.label}</div><div className="text-[11px] text-slate-500">{v.hint}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between"><span>Show my email</span><Switch on={p.privacy.showEmail} label="Show email" disabled={busy === 'privacy'} onChange={(v) => setPrivacy({ showEmail: v })} /></div>
                    <div className="flex items-center justify-between"><span>Show my task statistics</span><Switch on={p.privacy.showStats} label="Show statistics" disabled={busy === 'privacy'} onChange={(v) => setPrivacy({ showStats: v })} /></div>
                  </div>
                </Card>

                <Card title="My projects" hint="Only projects switched to Public appear on your public profile">
                  <div className="space-y-3">
                    {p.projects.map((x) => (
                      <div key={x.projectId} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><span className="clamp1 text-sm font-semibold text-slate-900">{x.name}</span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{x.phaseLabel}</span>
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{x.role}</span></div>
                            <p className="mt-1 text-xs text-slate-600">{x.contribution}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{x.stats.tasksDone}/{x.stats.tasksTotal} tasks done · {x.stats.onTimePct}% on time</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-center gap-1"><Switch on={x.isPublic} label={`Public: ${x.name}`} disabled={busy === 'proj:' + x.projectId} onChange={(v) => togglePublic(x.projectId, v)} /><span className="text-[10px] text-slate-500">{x.isPublic ? 'Public' : 'Private'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Recent activity" hint="Your latest actions across projects">
                  <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
                    {p.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-700">{a.text}</span><span className="shrink-0 text-[11px] text-slate-400">{a.ago}</span></div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <Card title="Security" hint="Change your password">
                  <form onSubmit={changePw} className="space-y-3">
                    <Field label="Current password"><input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} className={inputCls} /></Field>
                    <Field label="New password"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputCls} /></Field>
                    <Field label="Confirm new password"><input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={inputCls} /></Field>
                    <button type="submit" disabled={!pw.cur || !pw.next || busy === 'pw'} className="btn-primary-solid mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'pw' ? 'Updating…' : 'Update password'}</button>
                  </form>
                </Card>

                <Card title="Danger Zone" hint="Irreversible actions">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Deactivate account</h3>
                        <p className="text-[11px] text-slate-500">Temporarily hide your profile.</p>
                      </div>
                      <button onClick={deactivateAccount} disabled={busy === 'deactivate'} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Deactivate</button>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <h3 className="text-sm font-semibold text-red-600">Delete account</h3>
                        <p className="text-[11px] text-slate-500">Permanently remove all data.</p>
                      </div>
                      <button onClick={() => setShowDelete(true)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                    {showDelete && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="mb-2 text-xs font-medium text-red-800">Type "DELETE" to confirm:</p>
                        <div className="flex gap-2">
                          <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className={clsx(inputCls, 'bg-white py-1.5')} placeholder="DELETE" />
                          <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE' || busy === 'delete'} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">Confirm</button>
                          <button onClick={() => { setShowDelete(false); setDeleteConfirm(''); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="fixed-ambient-bg" />
      <div className="relative z-10 h-screen overflow-y-auto">{children}</div>
    </div>
  )
}
