import { ChevronRight } from 'lucide-react'
import type { HrZone } from '@/domain/activity/types'
import type { AerobicDecoupling } from '@/domain/activity/decoupling'
import { cardClass } from '@/components/ui/Card'
import { GlossaryTerm, type GlossaryKey } from '@/components/ui/GlossaryTerm'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { STAT_TONE_CLASS, type StatTone } from '@/components/ui/Stat'
import { zoneColor, type SessionZone } from '@/lib/colors'
import { formatDecimal, formatDeltaFixed } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  hrZones: HrZone[]
  aer: number | null
  ana: number | null
  decoupling: AerobicDecoupling | null
  onShowCharts?: () => void
}

/** Under this share a zone is left out of the bar and the legend alike, so
 *  every zone drawn has its label. */
const MIN_ZONE_PCT = 1

const TE_LEVELS = [
  { max: 1.0, label: t.activity.trainingEffect.levels.noBenefit, tone: 'muted' },
  { max: 2.0, label: t.activity.trainingEffect.levels.minor, tone: 'muted' },
  { max: 3.0, label: t.activity.trainingEffect.levels.maintaining, tone: 'muted' },
  { max: 4.0, label: t.activity.trainingEffect.levels.improving, tone: 'pos' },
  { max: 4.8, label: t.activity.trainingEffect.levels.highlyImproving, tone: 'pos' },
  { max: 5.1, label: t.activity.trainingEffect.levels.overreaching, tone: 'warn' },
] as const satisfies readonly { max: number; label: string; tone: StatTone }[]

function level(value: number) {
  return TE_LEVELS.find((l) => value < l.max) ?? TE_LEVELS[TE_LEVELS.length - 1]!
}

export function trainingEffectLevel(value: number): string {
  return level(value).label
}

export function trainingEffectTone(value: number): StatTone {
  return level(value).tone
}

function scored(value: number | null): value is number {
  return value != null && value > 0
}

function Row({ term, label, value, word, tone, onClick, actionLabel }: {
  term: GlossaryKey
  label: string
  value: string
  word: string
  tone: StatTone
  onClick?: () => void
  actionLabel?: string
}) {
  const reading = (
    <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1.5 text-right text-sm">
      <b className="font-semibold text-foreground">{value}</b>
      <span className={STAT_TONE_CLASS[tone]}>{word}</span>
      {onClick && <ChevronRight size={14} aria-hidden="true" className="self-center text-muted-foreground" />}
    </span>
  )
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border text-sm">
      <span className="text-muted-foreground">
        <GlossaryTerm term={term}>{label}</GlossaryTerm>
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={actionLabel} className="flex min-h-11 items-center transition-opacity active:opacity-70">
          {reading}
        </button>
      ) : (
        reading
      )}
    </div>
  )
}

export function RunEffortCard({ hrZones, aer, ana, decoupling, onShowCharts }: Props) {
  const zones = [...hrZones].sort((a, b) => a.zone - b.zone).filter((z) => z.percent >= MIN_ZONE_PCT)
  const hasEffect = scored(aer) || scored(ana)
  if (zones.length === 0 && !hasEffect && !decoupling) return null

  const d = t.activity.decoupling
  const decouplingHeld = decoupling ? decoupling.percent < 0 || decoupling.drift === 'stable' : true

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3.5' })} data-testid="run-effort">
      {zones.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-headline text-foreground">{t.activity.zones.short}</h3>
            <span className="text-xs text-muted-foreground">{t.activity.zones.shareOfTime}</span>
          </div>
          <div className="flex h-2.5 gap-[3px]" data-testid="zone-stack">
            {zones.map((zone) => (
              <span
                key={zone.zone}
                className="h-full rounded-full"
                style={{ flexGrow: zone.percent, flexBasis: 0, background: zoneColor(zone.zone as SessionZone) }}
              />
            ))}
          </div>
          <Legend className="gap-x-[18px]">
            {zones.map((zone) => (
              <LegendItem key={zone.zone} swatch="square" color={zoneColor(zone.zone as SessionZone)}>
                <span>
                  {`Z${zone.zone} ${t.zoneLabels[zone.zone] ?? ''} `}
                  <b className="font-semibold text-foreground">{Math.round(zone.percent)}%</b>
                </span>
              </LegendItem>
            ))}
          </Legend>
        </>
      )}

      {(hasEffect || decoupling) && (
        <div className={cn('flex flex-col', zones.length === 0 && '[&>div:first-child]:border-t-0')}>
          {scored(aer) && (
            <Row
              term="aerobicEffect"
              label={t.activity.trainingEffect.aerobic}
              value={formatDecimal(aer, 1)}
              word={trainingEffectLevel(aer)}
              tone={trainingEffectTone(aer)}
            />
          )}
          {scored(ana) && (
            <Row
              term="anaerobicEffect"
              label={t.activity.trainingEffect.anaerobic}
              value={formatDecimal(ana, 1)}
              word={trainingEffectLevel(ana)}
              tone={trainingEffectTone(ana)}
            />
          )}
          {decoupling && (
            <Row
              term="decoupling"
              label={t.glossary.decoupling.term}
              value={`${formatDeltaFixed(decoupling.percent, 1)}%`}
              word={decouplingHeld ? d.held : d.faded}
              tone={decouplingHeld ? 'pos' : 'warn'}
              onClick={onShowCharts}
              actionLabel={d.seeInCharts}
            />
          )}
        </div>
      )}
    </section>
  )
}
