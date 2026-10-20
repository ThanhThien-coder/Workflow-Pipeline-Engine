import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export interface SmoothScrollContextValue {
  lenis: Lenis | null
  scrollProgress: number
  isScrolling: boolean
  scrollTo: (target: string | HTMLElement | number, options?: any) => void
}

const SmoothScrollContext = createContext<SmoothScrollContextValue | null>(null)

// Đường cong giảm tốc hàm mũ kinh điển của Locomotive v5: khởi đầu dứt khoát, hãm phanh cực êm
export const LOCOMOTIVE_EASING = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))

export interface SmoothScrollProviderProps {
  children: ReactNode
}

/**
 * SmoothScrollProvider: Tối ưu Window-Level Scroll với Lenis & Locomotive Easing
 * - Điều khiển cuộn cấp Window trực tiếp cho LandingView
 * - Triệt tiêu hoàn toàn hiện tượng khựng/giật do giam trong container con
 * - Cập nhật thanh tiến độ cuộn qua CSS variable --scroll-progress & DOM trực tiếp (0 re-render Main Thread)
 * - Quản lý RAF trực tiếp từ trình duyệt nhận nhịp 60/120/144Hz
 * - Gắn (window as any).lenis để kiểm tra F12 Console & debug qua `?debugScroll=1`
 * - Tự động destroy và hoàn trả scroll state khi chuyển sang Workspace/Kanban/Admin
 */
export const SmoothScrollProvider: FC<SmoothScrollProviderProps> = ({ children }) => {
  const [lenis, setLenis] = useState<Lenis | null>(null)

  useEffect(() => {
    // BƯỚC 1 & 2: Mở khóa html cho window-level scroll trên trang Landing
    document.documentElement.classList.add('lenis', 'landing-mode')
    document.body.classList.add('landing-mode')

    // BƯỚC 3: Cấu hình Lenis ở chuẩn Window-level với duration 1.25s và Locomotive Easing
    const lenisInstance = new Lenis({
      wrapper: window,
      content: document.documentElement,
      duration: 1.25, // Quán tính lướt trôi 1.25s theo đúng chuẩn Locomotive
      easing: LOCOMOTIVE_EASING, // Hãm phanh hàm mũ siêu mượt
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true, // Bắt buộc bật làm mượt con lăn chuột
      wheelMultiplier: 1.0, // Tỉ lệ con lăn 1:1
      touchMultiplier: 1.0,
      syncTouch: false, // Giữ gesture cảm ứng native
      autoRaf: false, // Điều khiển qua RAF trực tiếp
    })

    // Gắn instance toàn cục phục vụ kiểm tra F12 Console
    ;(window as any).lenis = lenisInstance
    setLenis(lenisInstance)

    // Cập nhật chiều cao chính xác sau khi layout ổn định
    requestAnimationFrame(() => {
      lenisInstance.resize()
    })

    const handleResize = () => {
      lenisInstance.resize()
    }
    window.addEventListener('resize', handleResize)

    let isScrollingTimeout: ReturnType<typeof setTimeout> | null = null

    // Scroll listener: Cập nhật biến CSS & DOM trực tiếp để TRIỆT TIÊU re-render React Main Thread
    lenisInstance.on('scroll', (e: any) => {
      const progress = e.progress ?? 0
      document.documentElement.style.setProperty('--scroll-progress', String(progress))

      const progressEl = document.getElementById('editorial-scroll-progress')
      if (progressEl) {
        progressEl.style.transform = `scaleX(${progress})`
      }

      document.documentElement.classList.add('lenis-scrolling')

      if (import.meta.env.DEV && window.location.search.includes('debugScroll')) {
        console.log('[Lenis Active] velocity:', e.velocity, 'progress:', e.progress)
      }

      if (isScrollingTimeout) clearTimeout(isScrollingTimeout)
      isScrollingTimeout = setTimeout(() => {
        document.documentElement.classList.remove('lenis-scrolling')
      }, 140)
    })

    // Vòng lặp RAF trực tiếp từ trình duyệt
    let rafId: number
    function raf(time: number) {
      lenisInstance.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // Dọn dẹp an toàn khi rời trang Landing, hoàn trả vùng cuộn cho Workspace / Admin / Kanban
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafId)
      if (isScrollingTimeout) clearTimeout(isScrollingTimeout)
      document.documentElement.classList.remove('lenis', 'landing-mode', 'lenis-scrolling')
      document.body.classList.remove('landing-mode')
      lenisInstance.destroy()
      delete (window as any).lenis
      setLenis(null)
    }
  }, [])

  const scrollTo = useCallback((target: string | HTMLElement | number, options?: any) => {
    if (lenis) {
      lenis.scrollTo(target, {
        offset: -70,
        duration: 1.25,
        easing: LOCOMOTIVE_EASING,
        ...options,
      })
    } else if (typeof target === 'string') {
      const el = document.querySelector(target)
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lenis])

  const contextValue = useMemo<SmoothScrollContextValue>(
    () => ({
      lenis,
      scrollProgress: 0,
      isScrolling: false,
      scrollTo,
    }),
    [lenis, scrollTo]
  )

  return (
    <SmoothScrollContext.Provider value={contextValue}>
      <div className="w-full min-h-screen">
        {children}
      </div>
    </SmoothScrollContext.Provider>
  )
}

/** Hook lấy lenis instance hoặc đăng ký callback scroll */
export function useSmoothScroll(callback?: (lenis: Lenis) => void): Lenis | null {
  const ctx = useContext(SmoothScrollContext)
  useEffect(() => {
    if (!ctx?.lenis || !callback) return
    const cb = () => callback(ctx.lenis!)
    ctx.lenis.on('scroll', cb)
    return () => {
      ctx.lenis?.off('scroll', cb)
    }
  }, [ctx?.lenis, callback])
  return ctx?.lenis ?? null
}

/** Alias useLenis tương thích ngược */
export const useLenis = useSmoothScroll

/** Hook lấy context đầy đủ (scrollProgress, isScrolling, scrollTo) */
export function useSmoothScrollContext(): SmoothScrollContextValue {
  const ctx = useContext(SmoothScrollContext)
  if (!ctx) {
    throw new Error('useSmoothScrollContext must be used within SmoothScrollProvider')
  }
  return ctx
}
