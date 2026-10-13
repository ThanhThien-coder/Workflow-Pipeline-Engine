import { useState, useEffect, useCallback, useMemo } from 'react'

const ROUTE_CHANGE_EVENT = 'wpe_route_change'

export function navigate(to: string): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname + window.location.search === to) return

  window.history.pushState({}, '', to)
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT, { detail: to }))
}

export function replace(to: string): void {
  if (typeof window === 'undefined') return
  window.history.replaceState({}, '', to)
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT, { detail: to }))
}

export function useRouter() {
  const [location, setLocation] = useState(() => ({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
  }))

  useEffect(() => {
    const handleLocationChange = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      })
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)
    }
  }, [])

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  const push = useCallback((to: string) => {
    navigate(to)
  }, [])

  const replaceUrl = useCallback((to: string) => {
    replace(to)
  }, [])

  return {
    pathname: location.pathname,
    search: location.search,
    searchParams,
    navigate: push,
    replace: replaceUrl,
  }
}
