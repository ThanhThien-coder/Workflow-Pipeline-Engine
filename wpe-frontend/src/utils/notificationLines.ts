import type { NotificationDto } from '../types/notification.types'

/**
 * Tách thông báo thành 2 dòng: dòng chính (tiêu đề, nói đây là thông báo gì) và dòng phụ (nội dung).
 * Backend lưu tiêu đề + nội dung riêng (vd "New feedback from Dr. Tran (Teacher) on WPE-005" + lời góp ý);
 * trước đây chỉ hiện nội dung nên không biết là thông báo gì. Dòng phụ chỉ có khi khác dòng chính.
 * Thông báo mock chỉ có `text` thì giữ một dòng như cũ.
 */
export function notificationLines(n: Pick<NotificationDto, 'title' | 'message' | 'text'>): {
  headline: string
  detail: string | null
} {
  const title = n.title?.trim() ?? ''
  const message = n.message?.trim() ?? ''
  if (title) {
    return { headline: title, detail: message && message !== title ? message : null }
  }
  return { headline: n.text?.trim() || message, detail: null }
}
