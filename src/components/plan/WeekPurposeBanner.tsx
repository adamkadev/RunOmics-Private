import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import type { WeekAdherence, WeekLoadLevel } from '@/domain/training/weekSummary'
import { t } from '@/i18n'

const TONE_CLASS: Record<WeekLoadLevel, { border: string; text: string; from: string }> = {
  low:    { border: 'border-blue-500/30',   text: 'text-blue-600 dark:text-blue-400',   from: 'from-blue-500/10' },
  normal: { border: 'border-accent/30',     text: 'text-accent-text',                   from: 'from-accent/10' },
  high:   { border: 'border-amber-500/30',  text: 'text-amber-600 dark:text-amber-400', from: 'from-amber-500/10' },
}

const PURPOSE_LABEL: Record<WeekLoadLevel, string> = {
  low: t.plan.weekPurpose.recovery,
  normal: t.plan.weekPurpose.steady,
  high: t.plan.weekPurpose.build,
}

interface Props {
  level: WeekLoadLevel | null
  percent: number | null
  adherence: WeekAdherence | null
}

// Names the week's role from data already computed elsewhere (load vs the
// 8-week typical, planned-vs-done) rather than a fabricated block position -
// there's no training-plan/mesocycle model behind this app to say "3 of 4".
export function WeekPurposeBanner({ level, percent, adherence }: Props) {
  if (level === null && adherence === null) return null

  const tone = TONE_CLASS[level ?? 'normal']
  const title = level ? PURPOSE_LABEL[level] : t.plan.weekPurpose.thisWeek

  return (
    <GlassSurface
      variant="card"
      className={cn(
        'flex items-center justify-between gap-3 rounded-card-sm bg-gradient-to-br to-transparent p-3.5',
        tone.border,
        tone.from,
      )}
    >
      <div className="min-w-0">
        <div className={cn('text-[15px] font-bold leading-tight', tone.text)}>{title}</div>
        {percent !== null && (
          <div className="mt-0.5 text-xs text-muted-foreground">{t.plan.weekSummary.vsTypical(percent)}</div>
        )}
      </div>
      {adherence && (
        <div className="shrink-0 text-right">
          <div className={cn('text-base font-extrabold tabular-nums', tone.text)}>{adherence.percent}%</div>
          <div className="text-[10px] text-muted-foreground">
            {t.plan.weekPurpose.adherence(adherence.done, adherence.due)}
          </div>
        </div>
      )}
    </GlassSurface>
  )
}
