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
      onClick={() => router.back()}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  )
}
