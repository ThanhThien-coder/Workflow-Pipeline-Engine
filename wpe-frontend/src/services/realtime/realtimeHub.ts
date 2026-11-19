import { API_BASE_URL } from '../http/apiClient'
import * as authApi from '../impl/http/auth'

/** Mọi tên sự kiện SSE backend có thể gửi; EventSource cần addEventListener riêng cho từng tên. */
export const REALTIME_EVENT_NAMES = [
  'INIT',
  'TASK_UNLOCKED',
  'TASK_STATUS_CHANGED',
  'TASK_OVERDUE',
  'TASK_SUBMITTED',
  'TASK_REJECTED',
  'NOTIFICATION_RECEIVED',
  'PROJECT_TASKS_CHANGED',
  'PROJECT_CHANGED',
] as const

export type RealtimeHandler = (eventName: string, data: unknown) => void

const INITIAL_RETRY_MS = 3000
const MAX_RETRY_MS = 30000
const CLOSE_GRACE_MS = 2000

export interface RealtimeHub {
  /** Đăng ký nghe. Người đầu tiên mở đúng 1 EventSource cho cả tab; trả hàm hủy. data là JSON đã parse (INIT: chuỗi gốc). */
  subscribe: (handler: RealtimeHandler) => () => void
}

/** Tạo hub mới (test dùng trực tiếp; app dùng bản `realtimeHub` bên dưới). */
export function createRealtimeHub(): RealtimeHub {
  const handlers = new Set<RealtimeHandler>()
  let current: EventSource | null = null
  let opening = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = INITIAL_RETRY_MS
  // Tăng mỗi lần dừng hub để lần mở dở dang (đang chờ token) tự bỏ kết quả
  let generation = 0

  const dispatch = (eventName: string, data: unknown) => {
    for (const handler of Array.from(handlers)) {
      try {
        handler(eventName, data)
      } catch (err) {
        console.error(`[SSE] Handler error for ${eventName}:`, err)
      }
    }
  }

  const open = async () => {
    if (opening || current || handlers.size === 0) return
    opening = true
    const gen = generation
    let token: string | null
    try {
      token = await authApi.ensureFreshAccessToken()
    } finally {
      opening = false
    }
    if (gen !== generation || handlers.size === 0) return
    // Token null -> KHÔNG mở EventSource và KHÔNG hẹn giờ kết nối lại (phiên đã hết, phần đăng xuất do installAuthRefresh lo)
    if (!token) return

    const eventSource = new EventSource(`${API_BASE_URL}/realtime/subscribe?access_token=${encodeURIComponent(token)}`)
    current = eventSource

    for (const name of REALTIME_EVENT_NAMES) {
      eventSource.addEventListener(name, (e) => {
        const raw = (e as MessageEvent).data
        if (name === 'INIT') {
          retryDelay = INITIAL_RETRY_MS
          console.log('[SSE] Connected to the real-time stream:', raw)
          dispatch(name, raw)
          return
        }
        try {
          dispatch(name, JSON.parse(raw))
        } catch (err) {
          console.error(`[SSE] Failed to parse data ${name}:`, err)
        }
      })
    }

    eventSource.addEventListener('error', () => {
      if (current !== eventSource) return
      eventSource.close()
      current = null
      if (retryTimer !== null || handlers.size === 0) return
      const delay = retryDelay
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS)
      retryTimer = setTimeout(() => {
        retryTimer = null
        void open()
      }, delay)
    })
  }

  const stop = () => {
    generation++
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (current) {
      current.close()
      current = null
    }
    retryDelay = INITIAL_RETRY_MS
  }

  const subscribe = (handler: RealtimeHandler) => {
    handlers.add(handler)
    if (closeTimer !== null) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    void open()

    let active = true
    return () => {
      if (!active) return
      active = false
      handlers.delete(handler)
      if (handlers.size > 0) return
      if (closeTimer !== null) clearTimeout(closeTimer)
      // Chờ một chút trước khi đóng: đổi trang (hủy rồi đăng ký lại) không phải nối lại
      closeTimer = setTimeout(() => {
        closeTimer = null
        if (handlers.size === 0) stop()
      }, CLOSE_GRACE_MS)
    }
  }

  return { subscribe }
}

/** Hub dùng chung của cả tab: chỉ một EventSource dù có bao nhiêu màn đăng ký. */
export const realtimeHub: RealtimeHub = createRealtimeHub()
