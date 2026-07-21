import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration } from '@/lib/formatters'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  athlete: AthleteProfile
}

// Read-only tiles - values are hand-edited (or Garmin-synced) in public/data/athlete.json,
// not editable from the app.
function Tile({ label, unit, value }: { label: string; unit: string; value: string | number | undefined }) {
  return (
    <div className="rounded-xl px-2.5 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">
        {value !== undefined ? (
          <>
            {value}
            <span className="ml-1 text-caption font-medium text-subtle">{unit}</span>
          </>
        ) : (
          <span className="text-caption font-medium text-subtle">{t.profile.athlete.notSet}</span>
        )}
      </div>
    </div>
  )
}

export function ProfileAthleteStats({ athlete }: Props) {
  const a = t.settings.athlete

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{a.title}</h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={a.age} unit={t.units.yrs} value={athlete.age} />
        <Tile label={a.lthr} unit={t.units.bpm} value={athlete.lthrBpm} />
        <Tile
          label={a.thresholdPace}
          unit={t.units.minPerKm}
          value={athlete.thresholdPaceSecPerKm ? formatDuration(athlete.thresholdPaceSecPerKm) : undefined}
        />
        <Tile label={a.vma} unit="km/h" value={athlete.vmaKmh} />
        <Tile label={a.maxHr} unit={t.units.bpm} value={athlete.maxHrBpm} />
        <Tile label={a.restingHr} unit={t.units.bpm} value={athlete.restingHrBpm} />
      </div>

      {athlete.lastUpdate && (
        <div className="mt-4 border-t border-foreground/[0.06] pt-3.5 text-xs leading-snug text-muted-foreground">
          {t.pages.athlete.lastUpdated(formatRelativeAgo(athlete.lastUpdate))}
        </div>
        )}
    </GlassSurface>
  )
}
