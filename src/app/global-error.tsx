'use client'

import { BOOT_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

// Last-resort boundary: only renders if the root layout itself throws.
// It replaces the whole document, so the app's CSS is not guaranteed to be
// loaded - style inline. BOOT_COLORS is a plain constants module, so this
// stays free of any runtime that could itself be the thing that broke.
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
          background: BOOT_COLORS.background,
          color: BOOT_COLORS.foreground,
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
            background: BOOT_COLORS.actionBg,
            color: BOOT_COLORS.actionFg,
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
