'use client'

import { t } from '@/i18n'

// Last-resort boundary: only renders if the root layout itself throws.
// It replaces the whole document, so the app's CSS is not guaranteed to be
// loaded - style inline and keep it dependency-free.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang={t.locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#06091a',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600 }}>{t.pages.error.heading}</p>
        <p style={{ marginTop: 4, fontSize: 14, opacity: 0.7 }}>{t.pages.error.sub}</p>
        {error.digest && (
          <p style={{ marginTop: 4, fontSize: 12, opacity: 0.4, fontFamily: 'monospace' }}>{error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 24,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#10b981',
            color: '#06091a',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.pages.error.retry}
        </button>
      </body>
    </html>
  )
}
