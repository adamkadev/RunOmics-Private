'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { sectionLabel } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  fallbackHref?: string
  className?: string
}

export function BackButton({ label, fallbackHref = '/', className }: Props) {
  const router = useRouter()
  const origin = useNavigationOrigin()
  const originLabel = origin ? sectionLabel(origin.path) : null

  return (
    <button
      onClick={() => {
        if (!origin || !originLabel) router.push(fallbackHref)
        else if (origin.isImmediate) router.back()
        else router.push(origin.path)
      }}
      className={cn('mb-4 inline-flex items-center gap-1.5 text-subhead font-semibold text-muted-foreground transition-colors hover:text-foreground', className)}
    >
      <ArrowLeft size={16} strokeWidth={2.2} />
      {originLabel ?? label}
    </button>
  )
}
