import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from './SectionLabel'

export type VerdictTone = 'pos' | 'warn' | 'neg' | 'muted'

const TONE_COLOR: Record<VerdictTone, string> = {
  pos: 'var(--pos)',
  warn: 'var(--warn)',
  neg: 'var(--neg)',
  muted: 'var(--muted-foreground)',
}

/**
 * An insight's eyebrow (v4.17): a 7 px status dot and the verdict in the
 * same status colour - Hold back in warn, Strong session in pos, Replace
 * soon in warn. The card around it stays a plain surface; nothing tints it.
 */
export function VerdictEyebrow({ tone, children, className }: { tone: VerdictTone; children: ReactNode; className?: string }) {
  return (
    <p className={cn(EYEBROW_CLASS, 'flex items-center gap-2', className)} style={{ color: TONE_COLOR[tone] }}>
      <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: TONE_COLOR[tone] }} />
      {children}
    </p>
  )
}

/** Eyebrow, headline (17-22 px, 600) and body (14 px, text-2): the insight block. */
export function VerdictBlock({
  tone,
  eyebrow,
  headline,
  body,
  size = 'md',
  className,
}: {
  tone: VerdictTone
  eyebrow: ReactNode
  headline: ReactNode
  body?: ReactNode
  /** md 17 px, lg 22 px headline. */
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <VerdictEyebrow tone={tone}>{eyebrow}</VerdictEyebrow>
      <p className={cn('font-semibold leading-snug text-foreground [text-wrap:pretty]', size === 'lg' ? 'text-[22px]' : 'text-[17px]')}>{headline}</p>
      {body && <p className="text-sm leading-normal text-[var(--text-2)] [text-wrap:pretty]">{body}</p>}
    </div>
  )
}
