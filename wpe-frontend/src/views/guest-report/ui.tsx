/**
 * Mảnh giao diện dùng chung cho trang khách mới (chép từ mock v6:
 * docs/frontend/prototypes/guestLinkDemo-claude-v6.html). Phần trang (sections/) và phần
 * Phases & tasks (phases/) đều import từ đây; sửa ở đây là sửa cho cả hai.
 */
import type { ReactNode } from 'react'

const VN_TZ = 'Asia/Ho_Chi_Minh'

/** "07 Nov" theo giờ Việt Nam; null thì "—". */
export function fmtDay(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: VN_TZ })
}

/** "07 Nov 2026" theo giờ Việt Nam; null thì "—". */
export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: VN_TZ })
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export type TaskStatusKey = 'DONE' | 'REVIEW' | 'IN_PROGRESS' | 'TODO' | 'LOCKED'

/** [nhãn, lớp của chip, lớp của chấm màu] */
export const STATUS_CHIP: Record<string, [string, string, string]> = {
  DONE: ['Done', 'bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  REVIEW: ['In review', 'bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-400'],
  IN_PROGRESS: ['In progress', 'bg-blue-50 text-blue-700 ring-blue-200', 'bg-blue-500'],
  TODO: ['To do', 'bg-sky-50 text-sky-700 ring-sky-200', 'bg-sky-300'],
  LOCKED: ['Waiting', 'bg-slate-50 text-slate-500 ring-slate-200', 'bg-slate-300'],
  COMPLETED: ['Completed', 'bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
}
const chipOf = (s: string) => STATUS_CHIP[s] ?? STATUS_CHIP.TODO

/** Viền trái của thẻ task theo trạng thái. */
export const STATUS_BAR: Record<string, string> = {
  DONE: 'border-l-emerald-500',
  REVIEW: 'border-l-amber-400',
  IN_PROGRESS: 'border-l-blue-500',
  TODO: 'border-l-sky-300',
  LOCKED: 'border-l-slate-300',
}

export function StatusChip({ status }: { status: string }) {
  const [label, cls] = chipOf(status)
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>{label}</span>
}

export function StatusDot({ status }: { status: string }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${chipOf(status)[2]}`} />
}

/** Màu theo kết quả đánh giá phase (verdict.tone). [lớp chip, lớp thanh màu] */
export type Tone = 'emerald' | 'orange' | 'rose' | 'blue' | 'slate'
export const TONE: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  slate: 'bg-slate-50 text-slate-500 ring-slate-200',
}
export const TONE_BAR: Record<Tone, string> = {
  emerald: 'bg-emerald-400',
  orange: 'bg-orange-400',
  rose: 'bg-rose-400',
  blue: 'bg-blue-400',
  slate: 'bg-slate-300',
}

export function VerdictChip({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[tone] ?? TONE.slate}`}>{label}</span>
}

const AVATAR_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-600', 'bg-cyan-600', 'bg-slate-500']

export interface AvatarPerson {
  name: string
  initials: string
  /** Vị trí trong danh sách thành viên, để mỗi người giữ một màu. */
  colorIndex: number
}

/** null = task chưa có người nhận. */
export function Avatar({ person, size = 'h-6 w-6 text-[10px]' }: { person: AvatarPerson | null | undefined; size?: string }) {
  if (!person) {
    return <span title="No assignee" className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400`}>?</span>
  }
  return (
    <span title={person.name} className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full font-bold text-white ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length]}`}>
      {person.initials}
    </span>
  )
}

export function Card({ children, className = '', title, right, note, id }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; note?: ReactNode; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 print:break-inside-avoid print:shadow-none ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
            {note}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-xs text-slate-500">{children}</p>
}

/** Đầu mỗi phần lớn của trang: số thứ tự, tên, câu hỏi phần đó trả lời. */
export function SectionHead({ n, title, question }: { n: number; title: string; question: string }) {
  return (
    <div className="mb-4 mt-10 flex items-start gap-3 border-t border-slate-200 pt-7">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{n}</span>
      <div>
        <h2 className="text-lg font-bold leading-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{question}</p>
      </div>
    </div>
  )
}
