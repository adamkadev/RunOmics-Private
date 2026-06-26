'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  )
}
