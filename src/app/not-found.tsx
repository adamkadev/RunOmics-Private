import { ArrowLeft } from 'lucide-react'
import { HeaderMark } from '@/components/layout/HeaderMark'
import { ButtonLink } from '@/components/ui/Button'
import { t } from '@/i18n'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4">
        <HeaderMark size={44} />
      </div>
      <h1 className="text-6xl font-black text-foreground">{t.pages.notFound.code}</h1>
      <p className="mt-2 text-balance text-lg font-medium text-muted-foreground">
        {t.pages.notFound.heading}
      </p>
      <p className="mt-1 text-balance text-sm text-subtle">
        {t.pages.notFound.sub}
      </p>
      <ButtonLink href="/" variant="primary" className="mt-8 h-11 rounded-xl px-5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" />
        {t.pages.notFound.back}
      </ButtonLink>
    </div>
  )
}
