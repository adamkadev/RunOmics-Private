'use client'

import { ThemeProvider } from 'next-themes'
import { FullscreenChromeProvider } from '@/components/layout/FullscreenChromeContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <FullscreenChromeProvider>{children}</FullscreenChromeProvider>
    </ThemeProvider>
  )
}
