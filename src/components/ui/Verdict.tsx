import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from './SectionLabel'

export type VerdictTone = 'pos' | 'warn' | 'neg' | 'muted' | 'neutral' | 'accent'

const TONE_COLOR: Record<VerdictTone, string> = {
  accent: 'var(--accent-text)',
  pos: 'var(--pos)',
  warn: 'var(--warn)',
  neg: 'var(--neg)',
  muted: 'var(--muted-foreground)',
  // Neither good nor bad news (Building): body ink, so it doesn't read as dimmed or disabled.
  neutral: 'var(--text-2)',
}

const DOT_COLOR: Record<VerdictTone, string> = { ...TONE_COLOR, neutral: 'var(--muted-foreground)' }

export function VerdictEyebrow({ tone, children, className }: { tone: VerdictTone; children: ReactNode; className?: string }) {
  return (
    <p className={cn(EYEBROW_CLASS, 'flex items-center gap-2', className)} style={{ color: TONE_COLOR[tone] }}>
      <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: DOT_COLOR[tone] }} />
      {children}
    </p>
  )
}

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
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <VerdictEyebrow tone={tone}>{eyebrow}</VerdictEyebrow>
      {headline && (
        <p className={cn('font-semibold leading-snug text-foreground [text-wrap:pretty]', size === 'lg' ? 'text-[22px]' : 'text-[17px]')}>{headline}</p>
      )}
      {body && <p className="text-sm leading-normal text-[var(--text-2)] [text-wrap:pretty]">{body}</p>}
    </div>
  )
}
