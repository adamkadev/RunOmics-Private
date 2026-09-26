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
  ACCENT_CSS_STORAGE_KEY,
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  CUSTOM_ACCENT_ID,
  CUSTOM_ACCENT_STYLE_ID,
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
        {/* A custom accent has no block in globals.css, so its generated CSS
            rides along in storage and is injected here - before first paint,
            and without shipping the OKLCH maths to the document head. */}
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            if(${JSON.stringify(ACCENT_IDS)}.indexOf(a)>0){
              document.documentElement.setAttribute('data-accent',a);
            }else if(a&&a.indexOf('${CUSTOM_ACCENT_ID}:')===0){
              var css=localStorage.getItem('${ACCENT_CSS_STORAGE_KEY}');
              if(css){
                var s=document.createElement('style');
                s.id='${CUSTOM_ACCENT_STYLE_ID}';
                s.textContent=css;
                document.head.appendChild(s);
                document.documentElement.setAttribute('data-accent','${CUSTOM_ACCENT_ID}');
              }
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
