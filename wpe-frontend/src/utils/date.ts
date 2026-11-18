export const fmtDayMonth = (iso: string): string => { const date = new Date(iso); return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` }

/** Due date for display: "Nov 18", or "No due date" when empty/invalid. */
export const fmtDueDate = (iso?: string | null): string => {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No due date'
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}
