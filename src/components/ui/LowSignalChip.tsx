'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'

interface Props {
  title: string
  summary: string
  children: ReactNode
}

// Collapses a low-signal chart into a one-line stat chip; tapping reveals the
// full chart. Mobile-first: no signal worth a hover tooltip, so it's tap-to-expand.
export function LowSignalChip({ title, summary, children }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (expanded) return <>{children}</>

  return (
    <GlassSurface
      variant="card"
      className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
      onClick={() => setExpanded(true)}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-subtle">{title}</span>
        <span className="block truncate text-sm text-foreground/70">{summary}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-subtle" />
    </GlassSurface>
  )
}
