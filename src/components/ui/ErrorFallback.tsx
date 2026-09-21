'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { HeartCrack, RotateCcw, ArrowLeft } from 'lucide-react'
import { t } from '@/i18n'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export function ErrorFallback({ error, reset }: Props) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <HeartCrack size={24} className="mb-4 text-accent-text opacity-60" />
      <p className="text-lg font-medium text-muted-foreground">{t.pages.error.heading}</p>
      <p className="mt-1 text-sm text-subtle">{t.pages.error.sub}</p>
      {error.digest && <p className="mt-1 font-mono text-xs text-subtle/60">{error.digest}</p>}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/85"
        >
          <RotateCcw size={16} />
          {t.pages.error.retry}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.06]"
        >
          <ArrowLeft size={16} />
          {t.pages.error.back}
        </Link>
      </div>
    </div>
  )
}
