// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as authApi from '../../impl/http/auth'
import { createRealtimeHub, REALTIME_EVENT_NAMES } from '../realtimeHub'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  readyState = 1
  closed = false
  private listeners: Record<string, Array<(e: { data: string }) => void>> = {}
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, cb: (e: { data: string }) => void) {
    ;(this.listeners[type] ??= []).push(cb)
  }
  emit(type: string, data = '') {
    this.listeners[type]?.forEach((cb) => cb({ data }))
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('realtimeHub', () => {
  const original = globalThis.EventSource
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockResolvedValue('tok')
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    globalThis.EventSource = original
  })

  it('3 người đăng ký -> chỉ 1 EventSource', async () => {
    const hub = createRealtimeHub()
    hub.subscribe(vi.fn())
    hub.subscribe(vi.fn())
    hub.subscribe(vi.fn())
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0].url).toContain('/realtime/subscribe?access_token=tok')
  })

  it('hủy hết -> đóng sau 2 giây, không đóng sớm; đăng ký lại trong 2 giây thì giữ nguyên kết nối', async () => {
    const hub = createRealtimeHub()
    const off1 = hub.subscribe(vi.fn())
    await flush()
    const es = FakeEventSource.instances[0]
    off1()
    vi.advanceTimersByTime(1900)
    expect(es.closed).toBe(false)
    const off2 = hub.subscribe(vi.fn())
    vi.advanceTimersByTime(5000)
    await flush()
    expect(es.closed).toBe(false)
    expect(FakeEventSource.instances).toHaveLength(1)
    off2()
    vi.advanceTimersByTime(2000)
    expect(es.closed).toBe(true)
  })

  it('còn người đăng ký thì không đóng khi một người hủy', async () => {
    const hub = createRealtimeHub()
    const off1 = hub.subscribe(vi.fn())
    hub.subscribe(vi.fn())
    await flush()
    off1()
    vi.advanceTimersByTime(10000)
    expect(FakeEventSource.instances[0].closed).toBe(false)
  })

  it('đăng ký đủ mọi tên sự kiện và chuyển JSON đã parse tới mọi handler', async () => {
    const hub = createRealtimeHub()
    const a = vi.fn()
    const b = vi.fn()
    hub.subscribe(a)
    hub.subscribe(b)
    await flush()
    const es = FakeEventSource.instances[0]
    for (const name of REALTIME_EVENT_NAMES) {
      if (name === 'INIT') continue
      es.emit(name, JSON.stringify({ n: name }))
      expect(a).toHaveBeenCalledWith(name, { n: name })
      expect(b).toHaveBeenCalledWith(name, { n: name })
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    es.emit('PROJECT_CHANGED', 'không phải json')
    expect(a).toHaveBeenCalledTimes(REALTIME_EVENT_NAMES.length - 1)
  })

  it('một handler ném lỗi không chặn handler khác', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const hub = createRealtimeHub()
    const ok = vi.fn()
    hub.subscribe(() => {
      throw new Error('x')
    })
    hub.subscribe(ok)
    await flush()
    FakeEventSource.instances[0].emit('PROJECT_CHANGED', '{"a":1}')
    expect(ok).toHaveBeenCalled()
  })

  it('lỗi -> thử lại với thời gian chờ 3s, 6s...; INIT đặt lại về 3s', async () => {
    const hub = createRealtimeHub()
    hub.subscribe(vi.fn())
    await flush()
    FakeEventSource.instances[0].emit('error')
    expect(FakeEventSource.instances[0].closed).toBe(true)
    vi.advanceTimersByTime(2999)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(2)

    FakeEventSource.instances[1].emit('error')
    vi.advanceTimersByTime(5999)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(3)

    FakeEventSource.instances[2].emit('INIT', 'connected')
    FakeEventSource.instances[2].emit('error')
    vi.advanceTimersByTime(3000)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(4)
  })

  it('thời gian chờ tăng dần có trần 30 giây', async () => {
    const hub = createRealtimeHub()
    hub.subscribe(vi.fn())
    await flush()
    const delays = [3000, 6000, 12000, 24000, 30000, 30000]
    for (let i = 0; i < delays.length; i++) {
      FakeEventSource.instances[i].emit('error')
      vi.advanceTimersByTime(delays[i] - 1)
      await flush()
      expect(FakeEventSource.instances).toHaveLength(i + 1)
      vi.advanceTimersByTime(1)
      await flush()
      expect(FakeEventSource.instances).toHaveLength(i + 2)
    }
  })

  it('token null -> không mở EventSource và không thử lại', async () => {
    vi.spyOn(authApi, 'ensureFreshAccessToken').mockResolvedValue(null)
    const hub = createRealtimeHub()
    hub.subscribe(vi.fn())
    await flush()
    vi.advanceTimersByTime(60000)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('hủy hết khi đang chờ thử lại -> không mở lại', async () => {
    const hub = createRealtimeHub()
    const off = hub.subscribe(vi.fn())
    await flush()
    FakeEventSource.instances[0].emit('error')
    off()
    vi.advanceTimersByTime(60000)
    await flush()
    expect(FakeEventSource.instances).toHaveLength(1)
  })
})
