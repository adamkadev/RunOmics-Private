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
      className="flex cursor-pointer flex-col gap-1 p-4 transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
      onClick={() => setExpanded(true)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-subtle">{title}</span>
        <ChevronRight size={14} className="shrink-0 text-subtle" />
      </div>
      <span className="text-sm font-bold text-foreground">{summary}</span>
    </GlassSurface>
  )
}
