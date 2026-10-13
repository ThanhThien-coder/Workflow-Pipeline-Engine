export function relativeVi(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ`
  return hours < 48 ? 'Hôm qua' : `${Math.floor(hours / 24)} ngày`
}

export function relativeEn(iso: string, now = Date.now()): string {
  const diffMs = now - Date.parse(iso)
  if (diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

