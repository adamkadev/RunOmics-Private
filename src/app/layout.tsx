import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { t } from '@/i18n'
import { ACCENT_STORAGE_KEY } from '@/lib/accent'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'RunOmics',
    template: '%s - RunOmics',
  },
  description: t.meta.description,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RunOmics',
  },
  icons: {
    icon: [
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/icons/apple-touch-icon-180.png', sizes: '180x180' },
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
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef3f0' },
    { media: '(prefers-color-scheme: dark)',  color: '#070f0c' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            if(a&&a!=='nature'){
              document.documentElement.setAttribute('data-accent',a);
            }
            var isDark=localStorage.getItem('theme')==='dark'||
              (!localStorage.getItem('theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
            var bg={
              nature:      ['#eef3f0','#070f0c'],
              performance: ['#eff6ff','#06091a'],
              impact:      ['#fff1f2','#130608'],
              motivation:  ['#fff7ed','#130a04'],
              endurance:   ['#f5f3ff','#0d0a1a']
            };
            var k=(a&&bg[a])?a:'nature';
            var color=isDark?bg[k][1]:bg[k][0];
            document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',color);});
          }catch(e){}`}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
