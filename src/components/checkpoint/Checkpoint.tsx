import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import { CardHead } from '@/components/analytics/AnalyticsKit'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { Unit } from '@/components/ui/Stat'
import { DELTA_TONE_COLOR, type DeltaTone } from '@/lib/deltaTone'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { CHECKPOINT_HREF } from './checkpointHref'
import { type CheckpointPageView, type CheckpointTileView, type CompareRow, type CompareSection } from './checkpointView'

const TONES: DeltaTone[] = ['good', 'worse', 'flat']

function Summary({ summary }: { summary: Record<DeltaTone, number> }) {
  const words: Record<DeltaTone, (n: number) => string> = { good: t.checkpoint.better, worse: t.checkpoint.worse, flat: t.checkpoint.level }
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-[var(--text-2)]" data-testid="checkpoint-summary">
      {TONES.filter((tone) => summary[tone] > 0).map((tone) => (
        <li key={tone} className="flex items-center gap-1.5 tabular-nums" data-tone={tone}>
          <span aria-hidden className="size-2 rounded-full" style={{ background: DELTA_TONE_COLOR[tone] }} />
          {words[tone](summary[tone])}
        </li>
      ))}
    </ul>
  )
}

function Segments({ count, done }: { count: number; done: number }) {
  return (
    <div aria-hidden className="flex gap-[3px]" data-testid="checkpoint-segments">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-done={i < done || undefined} className={cn('h-[5px] flex-1 rounded-full', i < done ? 'bg-accent' : 'bg-[var(--line-2)]')} />
      ))}
    </div>
  )
}

function Row({ row }: { row: CompareRow }) {
  const color = row.delta === null ? 'var(--muted-foreground)' : DELTA_TONE_COLOR[row.tone]
  const Arrow = row.direction === 'up' ? ArrowUpRight : row.direction === 'down' ? ArrowDownRight : null
  return (
    <li className="flex flex-col gap-0.5 border-t border-border py-2.5 first:border-t-0 first:pt-1 last:pb-0" data-testid="checkpoint-row" data-key={row.key} data-tone={row.delta === null ? undefined : row.tone}>
      <span className="text-[13px] text-[var(--text-2)] text-pretty">{row.label}</span>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="text-[17px] font-semibold leading-snug tabular-nums text-foreground" data-testid="checkpoint-current">
            {row.current ?? '—'}
            {row.current !== null && row.unit && <Unit>{row.unit}</Unit>}
          </span>
          {row.previous !== null && <span className="text-[13px] tabular-nums text-muted-foreground">{t.checkpoint.vs(row.previous)}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium tabular-nums" style={{ color }} data-testid="checkpoint-delta">
          {Arrow && row.delta !== null && <Arrow size={12} strokeWidth={2} aria-hidden />}
          {row.delta ?? row.missing}
        </span>
      </div>
      {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
    </li>
  )
}

function Section({ section }: { section: CompareSection }) {
  return (
    <section className={cardClass({ className: 'flex flex-col gap-2' })} data-testid={`checkpoint-${section.key}`}>
      <CardHead title={section.title} caption={section.caption ?? undefined} about={section.about} />
      <ul className="flex flex-col">
        {section.rows.map((row) => <Row key={row.key} row={row} />)}
      </ul>
    </section>
  )
}

export function Checkpoint({ view }: { view: CheckpointPageView }) {
  const { status } = view
  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1">
        <span className={cn(EYEBROW_CLASS, 'text-accent-text')} data-testid="checkpoint-eyebrow">{view.eyebrow}</span>
        <h1 className="text-display text-foreground text-pretty">{t.checkpoint.title}</h1>
        <p className="text-sm text-muted-foreground text-pretty" data-testid="checkpoint-range">{view.range}</p>
      </header>

      <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="checkpoint-status">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="text-headline text-foreground">{status.title}</h2>
          {status.detail && <p className="text-xs text-muted-foreground">{status.detail}</p>}
        </div>
        {status.segments !== null && <Segments count={status.segments} done={status.week} />}
        {view.summary && <Summary summary={view.summary} />}
        {status.note && <p className="text-[13px] text-muted-foreground text-pretty">{status.note}</p>}
      </section>

      {view.sections.map((section) => <Section key={section.key} section={section} />)}
    </div>
  )
}

export function CheckpointTile({ view }: { view: CheckpointTileView }) {
  return (
    <Link
      href={CHECKPOINT_HREF}
      data-testid="checkpoint-tile"
      className={cardClass({ className: 'flex flex-col gap-2 px-4 py-3.5 text-left transition-transform duration-100 ease-out active:scale-[0.98]' })}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-headline text-foreground">{t.checkpoint.title}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </div>
      <span className="text-[13px] text-[var(--text-2)] text-pretty">{view.line}</span>
      {view.summary && <Summary summary={view.summary} />}
    </Link>
  )
}
