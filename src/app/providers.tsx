'use client'

import { ThemeProvider } from 'next-themes'
import { ThemeColorUpdater } from '@/components/layout/ThemeColorUpdater'
import { FullscreenChromeProvider } from '@/components/layout/FullscreenChromeContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorUpdater />
      <FullscreenChromeProvider>{children}</FullscreenChromeProvider>
    </ThemeProvider>
  )
}
