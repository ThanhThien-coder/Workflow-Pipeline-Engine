// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpWorkflowService } from '../HttpWorkflowService'
import { AUTH_TOKEN_KEY } from '../../http/apiClient'
import * as authApi from '../http/auth'

class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  static instances: MockEventSource[] = []

  url: string
  readyState: number = MockEventSource.OPEN
  closed = false
  private listeners: Record<string, Array<(event: any) => void>> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(listener)
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener)
    }
  }

  dispatchEvent(type: string, data?: any) {
    const event = { type, data }
    this.listeners[type]?.forEach(cb => cb(event))
  }

  close() {
    this.closed = true
    this.readyState = MockEventSource.CLOSED
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('HttpWorkflowService.connectRealtime', () => {
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
    MockEventSource.instances = []
    globalThis.EventSource = MockEventSource as any
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockImplementation(async () => {
      return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY) ?? null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    globalThis.EventSource = originalEventSource
  })

  it('có token example-token trong localStorage -> URL kết thúc bằng /realtime/subscribe?access_token=example-token và KHÔNG chứa userId', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const url = MockEventSource.instances[0].url
    expect(url.endsWith('/realtime/subscribe?access_token=example-token')).toBe(true)
    expect(url).not.toContain('userId')

    unsubscribe()
  })

  it('token có ký tự đặc biệt -> được encodeURIComponent', async () => {
    const specialToken = 'example-token+with/special==chars&query'
    localStorage.setItem(AUTH_TOKEN_KEY, specialToken)
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const url = MockEventSource.instances[0].url
    expect(url).toContain(`access_token=${encodeURIComponent(specialToken)}`)
    expect(url).not.toContain('userId')

    unsubscribe()
  })

  it('phát error với readyState = CLOSED, đổi token trong storage thành example-token-2, tua 3 giây -> mở EventSource mới với access_token=example-token-2', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token-1')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const firstEs = MockEventSource.instances[0]

    // Phát error với readyState = CLOSED
    firstEs.readyState = MockEventSource.CLOSED
    firstEs.dispatchEvent('error')

    // Đổi token trong storage thành example-token-2
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token-2')

    // Chưa đủ 3 giây -> chưa mở cái mới
    vi.advanceTimersByTime(2000)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(1)

    // Tua hết 3 giây (thêm 1000ms) -> mở cái mới với token mới
    vi.advanceTimersByTime(1000)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(2)
    expect(MockEventSource.instances[1].url.endsWith('/realtime/subscribe?access_token=example-token-2')).toBe(true)

    unsubscribe()
  })

  it('gọi hàm hủy rồi phát error và tua 60 giây -> không mở thêm EventSource nào', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const firstEs = MockEventSource.instances[0]

    // Hủy đăng ký
    unsubscribe()
    expect(firstEs.closed).toBe(true)

    // Phát error sau khi đã hủy
    firstEs.readyState = MockEventSource.CLOSED
    firstEs.dispatchEvent('error')

    // Tua 60 giây
    vi.advanceTimersByTime(60000)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(1)
  })

  it('phát TASK_STATUS_CHANGED với JSON hợp lệ -> onEvent được gọi với tên TASK_STATUS_CHANGED', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const onEvent = vi.fn()
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', onEvent)
    await flushMicrotasks()

    const es = MockEventSource.instances[0]
    const backendTask = {
      id: 10,
      code: 'WPE-010',
      title: 'Task example',
      description: 'Mô tả task',
      status: 'IN_PROGRESS',
      assignedUserId: 2,
      phaseId: 1,
      dueDate: '2026-11-20T23:59:59Z',
      version: 1,
      joinPolicy: 'ALL_COMPLETED',
    }

    es.dispatchEvent('TASK_STATUS_CHANGED', JSON.stringify(backendTask))

    expect(onEvent).toHaveBeenCalledWith(
      'TASK_STATUS_CHANGED',
      expect.objectContaining({
        id: '10',
        code: 'WPE-010',
        title: 'Task example',
        status: 'IN_PROGRESS',
      })
    )

    unsubscribe()
  })

  it('nhận sự kiện INIT thì đặt lại độ trễ kết nối lại về 3 giây', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    const es1 = MockEventSource.instances[0]
    // Lần lỗi 1 -> delay 3s (next delay sẽ là 6s nếu không có INIT)
    es1.readyState = MockEventSource.CLOSED
    es1.dispatchEvent('error')
    vi.advanceTimersByTime(3000)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(2)

    const es2 = MockEventSource.instances[1]
    // Nhận INIT -> đặt lại retryDelay về 3s
    es2.dispatchEvent('INIT', 'connected')

    // Lỗi tiếp sau khi INIT -> delay phải là 3s thay vì 6s
    es2.readyState = MockEventSource.CLOSED
    es2.dispatchEvent('error')

    vi.advanceTimersByTime(2500)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(2)

    vi.advanceTimersByTime(500)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(3)

    unsubscribe()
  })

  it('ensureFreshAccessToken (mock bằng vi.spyOn) trả example-token-new -> URL dùng token mới', async () => {
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockResolvedValue('example-token-new')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const url = MockEventSource.instances[0].url
    expect(url.endsWith('/realtime/subscribe?access_token=example-token-new')).toBe(true)
    expect(url).not.toContain('userId')

    unsubscribe()
  })

  it('ensureFreshAccessToken trả null -> không tạo EventSource nào và không hẹn giờ kết nối lại', async () => {
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockResolvedValue(null)
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    // Không tạo EventSource
    expect(MockEventSource.instances.length).toBe(0)

    // Tua thời gian 60 giây xem có hẹn giờ kết nối lại không -> vẫn không tạo
    vi.advanceTimersByTime(60000)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(0)

    unsubscribe()
  })

  it('gọi hàm hủy trước khi ensureFreshAccessToken giải quyết xong -> không tạo EventSource', async () => {
    let resolveToken: (token: string | null) => void = () => {}
    const tokenPromise = new Promise<string | null>((resolve) => {
      resolveToken = resolve
    })
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockReturnValue(tokenPromise)

    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())

    unsubscribe()

    resolveToken('example-token')
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(0)
  })

  it('đăng ký và parse đúng các sự kiện mới: TASK_SUBMITTED, TASK_REJECTED, PROJECT_TASKS_CHANGED', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const onEvent = vi.fn()
    const unsubscribe = service.connectRealtime('example-user-id', onEvent)
    await flushMicrotasks()

    const es = MockEventSource.instances[0]

    // 1. TASK_SUBMITTED
    const sampleTask = { id: 101, code: 'WPE-101', title: 'Task Submit', status: 'REVIEW', version: 1 }
    es.dispatchEvent('TASK_SUBMITTED', JSON.stringify(sampleTask))
    expect(onEvent).toHaveBeenCalledWith('TASK_SUBMITTED', expect.objectContaining({
      id: '101',
      code: 'WPE-101',
      title: 'Task Submit',
      status: 'REVIEW',
    }))

    // 2. TASK_REJECTED
    const rejectTask = { id: 102, code: 'WPE-102', title: 'Task Reject', status: 'TODO', rejectReason: 'Needs fix', version: 2 }
    es.dispatchEvent('TASK_REJECTED', JSON.stringify(rejectTask))
    expect(onEvent).toHaveBeenCalledWith('TASK_REJECTED', expect.objectContaining({
      id: '102',
      code: 'WPE-102',
      status: 'TODO',
      rejectReason: 'Needs fix',
    }))

    // 3. PROJECT_TASKS_CHANGED
    const projectEvent = { projectId: '10', phaseId: '20', taskId: '30', reason: 'STATUS_CHANGED' }
    es.dispatchEvent('PROJECT_TASKS_CHANGED', JSON.stringify(projectEvent))
    expect(onEvent).toHaveBeenCalledWith('PROJECT_TASKS_CHANGED', projectEvent)

    // 4. TASK_OVERDUE
    const overdueTask = { id: 103, code: 'WPE-103', title: 'Task Overdue', status: 'IN_PROGRESS', isOverdue: true, version: 1 }
    es.dispatchEvent('TASK_OVERDUE', JSON.stringify(overdueTask))
    expect(onEvent).toHaveBeenCalledWith('TASK_OVERDUE', expect.objectContaining({
      id: '103',
      code: 'WPE-103',
      status: 'IN_PROGRESS',
      isOverdue: true,
    }))

    unsubscribe()
  })

  it('xử lý error khi readyState là CONNECTING: đóng eventSource và áp dụng backoff', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    expect(MockEventSource.instances.length).toBe(1)
    const es1 = MockEventSource.instances[0]
    es1.readyState = MockEventSource.CONNECTING // readyState là CONNECTING chứ không phải CLOSED

    es1.dispatchEvent('error')

    // Phải đóng eventSource ngay lập tức
    expect(es1.closed).toBe(true)

    // Chưa đủ 3s -> chưa mở kết nối lại
    vi.advanceTimersByTime(2500)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(1)

    // Đủ 3s -> mở lại
    vi.advanceTimersByTime(500)
    await flushMicrotasks()
    expect(MockEventSource.instances.length).toBe(2)

    unsubscribe()
  })

  it('nhiều sự kiện error liên tiếp trong thời gian chờ không hẹn trùng lịch', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'example-token')
    const service = new HttpWorkflowService()
    const unsubscribe = service.connectRealtime('example-user-id', vi.fn())
    await flushMicrotasks()

    const es1 = MockEventSource.instances[0]
    es1.dispatchEvent('error')
    es1.dispatchEvent('error')
    es1.dispatchEvent('error')

    vi.advanceTimersByTime(3000)
    await flushMicrotasks()

    // Chỉ có 1 instance mới được mở, không tạo dư thừa
    expect(MockEventSource.instances.length).toBe(2)

    unsubscribe()
  })
})
