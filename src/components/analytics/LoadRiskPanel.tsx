import type { LoadRiskPanel as LoadRiskPanelData, RiskZone } from '@/application/usecases/GetLoadRiskPanel'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { t } from '@/i18n'

const ZONE_TONE: Record<RiskZone, StatusTone> = {
  low: 'blue',
  safe: 'green',
  caution: 'amber',
  risk: 'red',
}

function Tile({
  label,
  value,
  description,
  zone,
  source,
}: {
  label: string
  value: string
  description: string
  zone: RiskZone | null
  source?: string
}) {
  const s = t.loadRisk
  const tone: StatusTone = zone ? ZONE_TONE[zone] : 'zinc'
  const zoneLabel = zone ? s.zone[zone] : s.insufficientData

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5">
      <div className="widget-label mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        {label}
        {source && <span className="rounded bg-foreground/[0.08] px-1 py-px text-[10px] font-medium normal-case">{source}</span>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-title2 font-extrabold tabular-nums text-foreground">{value}</span>
        <StatusPill tone={tone}>{zoneLabel}</StatusPill>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{description}</p>
    </div>
  )
}

export function LoadRiskPanel({ data }: { data: LoadRiskPanelData }) {
  const s = t.loadRisk

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground/80">
        {s.title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label={s.acwr.label}
          value={data.acwr !== null ? data.acwr.toFixed(2) : '–'}
          description={data.acwrSource === 'garmin' ? s.acwr.descriptionGarmin : s.acwr.description}
          zone={data.acwrZone}
          source={data.acwrSource ? s.source[data.acwrSource] : undefined}
        />
        <Tile
          label={s.monotony.label}
          value={data.monotony !== null ? data.monotony.toFixed(1) : '–'}
          description={s.monotony.description}
          zone={data.monotonyZone}
        />
        <Tile
          label={s.strain.label}
          value={data.strain !== null ? String(data.strain) : '–'}
          description={s.strain.description}
          zone={data.strainZone}
        />
        <Tile
          label={s.rampRate.label}
          value={data.rampRate !== null ? `${data.rampRate >= 0 ? '+' : ''}${data.rampRate}` : '–'}
          description={s.rampRate.description}
          zone={data.rampRateZone}
        />
      </div>
    </GlassSurface>
  )
}
