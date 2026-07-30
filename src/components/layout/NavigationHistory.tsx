'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { findOrigin, type NavigationOrigin } from '@/lib/navigation'

const NavigationOriginContext = createContext<NavigationOrigin | null>(null)

export function useNavigationOrigin(): NavigationOrigin | null {
  return useContext(NavigationOriginContext)
}

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentPath = useRef(pathname)
  const stack = useRef<string[]>([])
  const isPopNavigation = useRef(false)
  const [origin, setOrigin] = useState<NavigationOrigin | null>(null)

  useEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const from = currentPath.current
    if (from === pathname) return
    currentPath.current = pathname

    if (isPopNavigation.current) {
      isPopNavigation.current = false
      stack.current.pop()
    } else {
      stack.current.push(from)
    }
    setOrigin(findOrigin(stack.current, pathname))
  }, [pathname])

  return <NavigationOriginContext.Provider value={origin}>{children}</NavigationOriginContext.Provider>
}
