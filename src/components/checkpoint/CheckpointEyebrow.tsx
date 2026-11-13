'use client'

import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { useCoachWords } from '@/components/coaching/useCoachWords'
import { cn } from '@/lib/utils'

/** The block's name is the coach's text, read after load as on Plan, so it never sits in the page's cached HTML. */
export function CheckpointEyebrow({ text, withBlock }: { text: string; withBlock: boolean }) {
  const words = useCoachWords(withBlock)
  const block = withBlock ? words?.block.name || null : null
  return (
    <span className={cn(EYEBROW_CLASS, '-mb-1.5 text-muted-foreground')} data-testid="checkpoint-eyebrow">
      {block ? `${text} · ${block}` : text}
    </span>
  )
}
