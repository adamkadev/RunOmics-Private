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
import { GLOW_ATTR, GLOW_STORAGE_KEY } from '@/lib/glowKeys'

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
    // Opaque, with dark text in light mode, as the Claude app's light top
    // (owner, Oct 2026). black-translucent let the page blur behind the
    // notch but always draws white status-bar text, which needed a dark band
    // over a light page. The opaque bar takes its colour from theme-color at
    // install, so that colour is the page's --background (STATUS_BAR_COLOR)
    // and the page top meets it in that colour; the frosted top bar starts
    // just under it. Read at install time: an installed app must be re-added
    // for a change to show. 'default' in dark too (F15): this meta takes no
    // media query, so dark can't have black-translucent on its own, and
    // light can't have it at all.
    statusBarStyle: 'default',
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
  // The page's --background in each mode (F15): the opaque status bar iOS
  // paints from it is the page itself, with no band above the header. Fixed,
  // never rewritten at runtime: iOS stores it at install, and a value changed
  // later (the accent, an in-app theme switch) never reaches the bar.
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
        {/* The reader's accent and light background before first paint. A
            pre-v4.3 id reads as its nearest palette (LEGACY_ACCENTS); the
            defaults - teal, the Aura - need no attribute, so the aura never
            flashes in before Plain applies (Liquid Glass v3, G14). */}
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            var legacy=${JSON.stringify(LEGACY_ACCENTS)};
            if(a&&legacy[a])a=legacy[a];
            if(a!=='${DEFAULT_ACCENT}'&&${JSON.stringify(ACCENT_IDS)}.indexOf(a)>=0){
              document.documentElement.setAttribute('data-accent',a);
            }
            if(localStorage.getItem('${GLOW_STORAGE_KEY}')==='off'){
              document.documentElement.setAttribute('${GLOW_ATTR}','off');
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
