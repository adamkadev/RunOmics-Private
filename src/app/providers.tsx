'use client'

import { ThemeProvider } from 'next-themes'
import { ThemeColorUpdater } from '@/components/layout/ThemeColorUpdater'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorUpdater />
      {children}
    </ThemeProvider>
  )
}
