'use client'

import { BackButton } from '@/components/ui/BackButton'
import { useUrlParam } from '@/lib/useUrlParam'
import { t } from '@/i18n'

/** Where a pair's page goes back to: Shoes when it was opened from there (?from=shoes), else Progress. */
export function shoeBackLink(from: string | null): { label: string; href: string } {
  return from === 'shoes' ? { label: t.pages.shoes.title, href: '/shoes' } : { label: t.shoes.detail.back, href: '/profile' }
}

/** A pair's way back, to the page it was opened from (design review, Oct 2026). */
export function ShoeBackButton({ className }: { className?: string }) {
  const [from] = useUrlParam('from')
  const { label, href } = shoeBackLink(from)
  return <BackButton label={label} fallbackHref={href} className={className} />
}
