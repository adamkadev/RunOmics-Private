import { ChevronRight } from 'lucide-react'
import type { HrZone } from '@/domain/activity/types'
import type { AerobicDecoupling } from '@/domain/activity/decoupling'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { GlossaryTerm, type GlossaryKey } from '@/components/ui/GlossaryTerm'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
import { formatDeltaFixed } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  hrZones: HrZone[]
  aer: number | null
  ana: number | null
  decoupling: AerobicDecoupling | null
  /** Opens Charts, where heart rate sits over pace and the drift shows. */
  onShowCharts?: () => void
}

/** Under this share a zone is left out of the header line. */
const HEADER_MIN_PCT = 5

const TE_LEVELS = [
  { max: 1.0, label: t.activity.trainingEffect.levels.noBenefit },
  { max: 2.0, label: t.activity.trainingEffect.levels.minor },
  { max: 3.0, label: t.activity.trainingEffect.levels.maintaining },
  { max: 4.0, label: t.activity.trainingEffect.levels.improving },
  { max: 4.8, label: t.activity.trainingEffect.levels.highlyImproving },
  { max: 5.1, label: t.activity.trainingEffect.levels.overreaching },
]

export function trainingEffectLevel(value: number): string {
  return (TE_LEVELS.find((l) => value < l.max) ?? TE_LEVELS[TE_LEVELS.length - 1]!).label
}

function scored(value: number | null): value is number {
  return value != null && value > 0
}

function Row({ term, label, value, word, tone, onClick, actionLabel }: {
  term: GlossaryKey
  label: string
  value: string
  word: string
  tone: string
  /** The value opens something (decoupling opens Charts): it gets a chevron. */
  onClick?: () => void
  actionLabel?: string
}) {
  const reading = (
    <>
      <span className="font-display text-title3 font-bold tabular-nums leading-none">{value}</span>
      <span className="text-footnote font-medium">{word}</span>
      {onClick && <ChevronRight size={14} aria-hidden="true" className="self-center" />}
    </>
  )
  const readingClass = cn('flex items-baseline gap-1.5 whitespace-nowrap', tone)
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-subhead text-foreground">
        <GlossaryTerm term={term}>{label}</GlossaryTerm>
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} aria-label={actionLabel} className="flex min-h-11 items-center transition-opacity active:opacity-70">
          <span className={readingClass}>{reading}</span>
        </button>
      ) : (
        <span className={readingClass}>{reading}</span>
      )}
    </div>
  )
}

/**
 * How hard the run was, in one card (H12, M9): time in HR zones as a bar,
 * then aerobic effect and decoupling as rows - a value and one word each, the
 * definitions behind their ⓘ. Three cards and a sentence said the same.
 */
export function RunEffortCard({ hrZones, aer, ana, decoupling, onShowCharts }: Props) {
  const zones = [...hrZones].sort((a, b) => a.zone - b.zone).filter((z) => z.percent > 0)
  const header = zones
    .filter((z) => z.percent >= HEADER_MIN_PCT)
    .map((z) => `Z${z.zone} ${Math.round(z.percent)}`)
    .join(' · ')
  const hasEffect = scored(aer) || scored(ana)
  if (zones.length === 0 && !hasEffect && !decoupling) return null

  const d = t.activity.decoupling
  const decouplingHeld = decoupling ? decoupling.percent < 0 || decoupling.drift === 'stable' : true
  const decouplingRow = decoupling && (
    <Row
      term="decoupling"
      label={t.glossary.decoupling.term}
      value={`${formatDeltaFixed(decoupling.percent, 1)}%`}
      word={decouplingHeld ? d.held : d.faded}
      tone={decouplingHeld ? STATUS.success.text : STATUS.warning.text}
      onClick={onShowCharts}
      actionLabel={d.seeInCharts}
    />
  )

  return (
    <GlassSurface variant="card" className="rounded-[22px] px-4.5 py-4" data-testid="run-effort">
      {zones.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-subhead text-foreground">{t.activity.zones.short}</span>
            <span className="text-subhead tabular-nums text-muted-foreground">{header}</span>
          </div>
          <div className="mt-3 flex h-2.5 gap-1" data-testid="zone-stack">
            {zones.map((zone) => (
              <span
                key={zone.zone}
                className={cn('h-full rounded-full', ZONE_COLOR_CLASSES[zone.zone]?.bg)}
                style={{ flexGrow: zone.percent, flexBasis: 0 }}
              />
            ))}
          </div>
          <ul className="sr-only">
            {zones.map((zone) => (
              <li key={zone.zone}>{`Z${zone.zone} · ${t.zoneLabels[zone.zone] ?? ''}: ${Math.round(zone.percent)}%`}</li>
            ))}
          </ul>
        </>
      )}

      {(hasEffect || decoupling) && (
        <div className={cn(zones.length > 0 && 'mt-3.5 border-t border-border pt-1.5')}>
          {scored(aer) && (
            <Row
              term="aerobicEffect"
              label={t.activity.trainingEffect.aerobic}
              value={aer.toFixed(1)}
              word={trainingEffectLevel(aer)}
              tone={aer >= 1 ? STATUS.success.text : 'text-muted-foreground'}
            />
          )}
          {scored(ana) && (
            <Row
              term="anaerobicEffect"
              label={t.activity.trainingEffect.anaerobic}
              value={ana.toFixed(1)}
              word={trainingEffectLevel(ana)}
              tone={ana >= 1 ? STATUS.success.text : 'text-muted-foreground'}
            />
          )}
          {decouplingRow}
        </div>
      )}
    </GlassSurface>
  )
}
