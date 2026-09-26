import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
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

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ variable: '--font-space-grotesk', subsets: ['latin'], weight: ['500', '600', '700'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'RunOmics',
    template: '%s - RunOmics',
  },
  description: t.meta.description,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // Opaque, with dark text in light mode. black-translucent always draws
    // white status-bar text (unreadable on the light theme) and iOS 26+ blurs
    // the band under it. The opaque bar takes its colour from theme-color at
    // install, so that colour is a fixed neutral (STATUS_BAR_COLOR) the page
    // top matches. Read at install time: an installed app must be re-added.
    statusBarStyle: 'default',
    title: 'RunOmics',
    startupImage: [...appleStartupImages],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [{ url: '/icons/logo.svg', type: 'image/svg+xml' }],
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
