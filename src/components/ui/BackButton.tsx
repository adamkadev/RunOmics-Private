'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface Props {
  label: string
  fallbackHref?: string
}

export function BackButton({ label, fallbackHref = '/' }: Props) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
      className="mb-4 inline-flex items-center gap-1.5 text-subhead font-semibold text-[#5c6a62] transition-colors hover:text-foreground dark:text-white/65"
    >
      <ArrowLeft size={16} strokeWidth={2.2} />
      {label}
    </button>
  )
}
