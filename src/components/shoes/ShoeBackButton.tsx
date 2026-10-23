'use client'

import { BackButton } from '@/components/ui/BackButton'
import { useUrlParam } from '@/lib/useUrlParam'
import { t } from '@/i18n'

export function shoeBackLink(from: string | null): { label: string; href: string } {
  return from === 'shoes' ? { label: t.pages.shoes.title, href: '/shoes' } : { label: t.shoes.detail.back, href: '/profile' }
}

export function ShoeBackButton({ className }: { className?: string }) {
  const [from] = useUrlParam('from')
  const { label, href } = shoeBackLink(from)
  return <BackButton label={label} fallbackHref={href} className={className} />
}
