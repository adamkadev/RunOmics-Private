import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { t } from '@/i18n'
import { ACCENT_STORAGE_KEY } from '@/lib/accent'
import { appleStartupImages } from '@/lib/splashScreens'

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
    statusBarStyle: 'black-translucent',
    title: 'RunOmics',
    startupImage: [...appleStartupImages],
  },
  other: {
    // Next 16's `appleWebApp.capable` now emits only the standardized
    // `mobile-web-app-capable`. iOS still needs the legacy apple-prefixed meta
    // to honour the apple-touch-startup-image launch screens - without it the
    // installed PWA opens on a black screen instead of the splash.
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
  viewportFit: 'cover',
  // theme-color is set dynamically by ThemeSync (accent + light/dark aware);
  // a static value here would fight its updates.
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
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            if(a&&a!=='nature'){
              document.documentElement.setAttribute('data-accent',a);
            }
          }catch(e){}`}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}