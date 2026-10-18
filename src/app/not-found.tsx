import Link from 'next/link'
import { HeartPulse, ArrowLeft } from 'lucide-react'
import { t } from '@/i18n'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <HeartPulse size={24} aria-hidden="true" className="mb-4 text-accent-text" />
      <h1 className="text-6xl font-black text-foreground">{t.pages.notFound.code}</h1>
      <p className="mt-2 text-balance text-lg font-medium text-muted-foreground">
        {t.pages.notFound.heading}
      </p>
      <p className="mt-1 text-balance text-sm text-subtle">
        {t.pages.notFound.sub}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/85"
      >
        <ArrowLeft size={16} />
        {t.pages.notFound.back}
      </Link>
    </div>
  )
}
