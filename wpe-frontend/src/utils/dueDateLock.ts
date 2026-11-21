/**
 * Quy tắc khóa hạn chót (G6 / TASK_04):
 * - Task DONE (có hoặc không có hạn): không cho sửa/thêm/xoá hạn.
 * - Hạn đã qua (so theo ngày, giờ Việt Nam UTC+7): không cho sửa/xoá hạn.
 * - Gỡ tiền tố DUE_DATE_LOCKED: / OVERDUE_TASK_LOCKED: khi hiển thị lỗi từ backend.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const LOCK_PREFIX_RE = /^(?:DUE_DATE_LOCKED|OVERDUE_TASK_LOCKED):\s*/

export const DUE_DATE_PASSED_LOCK_TITLE =
  'Due date passed — locked so the late record stays accurate'
export const TASK_DONE_LOCK_TITLE = 'Task is done — due date locked'

export interface LockableDueTask {
  status?: string | null
  due?: string | null
  dueDate?: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

function toVnDateKey(input: Date | number | string): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    if (DATE_ONLY_RE.test(trimmed)) return trimmed
  }
  const ms =
    input instanceof Date
      ? input.getTime()
      : typeof input === 'number'
        ? input
        : Date.parse(String(input).trim())
  if (!Number.isFinite(ms)) return null
  const vn = new Date(ms + VN_OFFSET_MS)
  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`
}

/** Trả về câu giải thích khóa hạn (dùng làm `title`), hoặc null nếu không bị khóa. */
export function dueDateLockReason(
  task: LockableDueTask | null | undefined,
  now: Date | number | string = new Date(),
): string | null {
  if (!task) return null
  if (task.status === 'DONE') return TASK_DONE_LOCK_TITLE

  const rawDue = task.dueDate ?? task.due
  if (!rawDue) return null
  const dueDay = toVnDateKey(rawDue)
  if (!dueDay) return null

  const todayVn = toVnDateKey(now)
  if (todayVn && dueDay < todayVn) return DUE_DATE_PASSED_LOCK_TITLE

  return null
}

/** True khi task DONE hoặc hạn chót đã qua ngày (giờ Việt Nam). */
export function isDueDateLocked(
  task: LockableDueTask | null | undefined,
  now: Date | number | string = new Date(),
): boolean {
  return dueDateLockReason(task, now) !== null
}

/** Bỏ tiền tố `DUE_DATE_LOCKED: ` hoặc `OVERDUE_TASK_LOCKED: `, chỉ giữ câu giải thích. */
export function friendlyLockMessage(err: unknown): string {
  let raw = ''
  if (typeof err === 'string') {
    raw = err
  } else if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    raw = (err as { message: string }).message
  }
  return raw.replace(LOCK_PREFIX_RE, '').trim()
}
