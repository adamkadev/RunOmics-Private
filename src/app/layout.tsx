import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { NoPinchZoom } from '@/components/layout/NoPinchZoom'
import { t } from '@/i18n'
import {
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  LEGACY_ACCENTS,
} from '@/lib/accent'
import { appleStartupImages } from '@/lib/splashScreens'
import { STATUS_BAR_COLOR } from '@/lib/themeTokens'

// One family for everything, numbers included (v4.17): Geist, the variable
// font whole (SIL OFL, fonts/Geist-LICENSE.txt). Google's latin subset left
// out the subscript in VO₂ and the ↗ ↘ trend arrows, which fell back to
// another face. The display face with the slab "1" and the mono are gone.
const geist = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist',
  weight: '100 900',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'RunOmics',
    template: '%s - RunOmics',
  },
  description: t.meta.description,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // Translucent (owner, Oct 2026): the page runs under the notch, so the
    // top glass blurs what scrolls behind the status bar too, as a native
    // app's does. Its text is always white, so the notch zone is dark in
    // both modes (NOTCH_COLOR, --status-bar). The opaque 'default' bar kept
    // the notch out of reach of the page. Read at install time: an installed
    // app must be re-added for a change to show.
    statusBarStyle: 'black-translucent',
    title: 'RunOmics',
    startupImage: [...appleStartupImages],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/web-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/web-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: {
    type: 'website',
    siteName: 'RunOmics',
    title: 'RunOmics',
    description: t.meta.description,
  },
  twitter: {
    card: 'summary',
    title: 'RunOmics',
    description: t.meta.description,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No page zoom. Browsers that honour these stop here; iOS Safari ignores
  // them, so NoPinchZoom cancels its pinch in the page.
  maximumScale: 1,
  userScalable: false,
  // Still `cover`, for the bottom inset the tab bar pads by.
  viewportFit: 'cover',
  // Fixed, never rewritten at runtime: iOS stores it at install, and a value
  // changed later (the accent, an in-app theme switch) never reaches the bar.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: STATUS_BAR_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: STATUS_BAR_COLOR.dark },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={t.locale.split('-')[0]}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="h-full">
        {/* The reader's accent before first paint. A pre-v4.3 id reads as its
            nearest palette (LEGACY_ACCENTS); the default needs no attribute. */}
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            var legacy=${JSON.stringify(LEGACY_ACCENTS)};
            if(a&&legacy[a])a=legacy[a];
            if(a!=='${DEFAULT_ACCENT}'&&${JSON.stringify(ACCENT_IDS)}.indexOf(a)>=0){
              document.documentElement.setAttribute('data-accent',a);
            }
          }catch(e){}`}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <NoPinchZoom />
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
