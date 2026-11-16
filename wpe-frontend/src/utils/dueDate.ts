/**
 * G21: hạn chót theo ngày (giờ máy người dùng).
 * - Ô nhập dùng chuỗi yyyy-mm-dd.
 * - Gửi lên backend: cuối ngày đó theo giờ máy (23:59:59), nên task chỉ quá hạn khi hết ngày.
 * - Hạn chót không được sớm hơn ngày tạo task (cùng ngày được phép).
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Thời điểm ISO → yyyy-mm-dd theo giờ máy. Rỗng hoặc sai định dạng → ''. */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** yyyy-mm-dd → ISO của 23:59:59 ngày đó theo giờ máy. */
export function dateInputToEndOfDayIso(dateInput: string): string {
  const d = new Date(`${dateInput}T23:59:59`)
  return Number.isNaN(d.getTime()) ? `${dateInput}T23:59:59.000Z` : d.toISOString()
}

/** Ngày sớm nhất được chọn làm hạn chót: ngày tạo task, chưa biết thì hôm nay. */
export function minDueDateInput(createdAt?: string | null): string {
  return isoToDateInput(createdAt) || isoToDateInput(new Date().toISOString())
}

/** Thông báo lỗi nếu hạn chót sớm hơn ngày tạo task, hợp lệ thì null. */
export function dueDateError(dateInput: string, createdAt?: string | null): string | null {
  if (!dateInput) return null
  const min = minDueDateInput(createdAt)
  return dateInput < min ? `Due date cannot be earlier than the day the task was created (${min}).` : null
}
