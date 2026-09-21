'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

const ACTIVITY_DETAIL_RE = /^\/activities\/[^/]+$/

function transitionClass(prevPath: string, path: string): string {
  if (prevPath === '/activities' && ACTIVITY_DETAIL_RE.test(path)) return 'animate-cal-forward'
  if (ACTIVITY_DETAIL_RE.test(prevPath) && path === '/activities') return 'animate-cal-backward'
  return 'animate-fade-up'
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [className, setClassName] = useState('animate-fade-up')

  if (pathname !== prevPathname) {
    setClassName(transitionClass(prevPathname, pathname))
    setPrevPathname(pathname)
  }

  return (
    <div key={pathname} className={className}>
      {children}
    </div>
  )
}
