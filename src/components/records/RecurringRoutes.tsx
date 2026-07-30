import Link from 'next/link'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatCompactDate, formatDistance, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  routes: RecurringRoute[]
}

const OUTLINE_BOX = 100

function Outline({ path }: { path: string }) {
  return (
    <svg
      viewBox={`-6 -6 ${OUTLINE_BOX + 12} ${OUTLINE_BOX + 12}`}
      className="h-16 w-16 shrink-0 text-accent-text"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** One dot per pass, fastest at the top, so a trend shows without a chart library. */
function PaceTrail({ route }: { route: RecurringRoute }) {
  const paces = route.runs.map((r) => r.paceSecPerKm)
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  const span = slowest - fastest || 1

  return (
    <div className="flex h-8 items-end gap-1" aria-hidden="true">
      {route.runs.map((run) => (
        <span
          key={run.activityId}
          className="w-1.5 rounded-full bg-accent/70"
          style={{ height: `${20 + ((slowest - run.paceSecPerKm) / span) * 80}%` }}
        />
      ))}
    </div>
  )
}

export function RecurringRoutes({ routes }: Props) {
  if (routes.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-title3 font-bold text-foreground">{t.records.recurring.title}</h2>
        <p className="mt-0.5 text-caption text-muted-foreground">{t.records.recurring.subtitle}</p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {routes.map((route) => (
          <li key={route.id}>
            <GlassSurface variant="card" className="flex items-center gap-3 rounded-2xl p-3">
              <Outline path={route.outline} />

              <div className="min-w-0 flex-1">
                <p className="font-display text-subhead font-bold text-foreground">
                  {formatDistance(route.distanceKm)} {t.units.km}
                  <span className="ml-1.5 text-caption font-medium text-subtle">
                    {t.records.recurring.runCount(route.runCount)}
                  </span>
                </p>

                <Link
                  href={`/activities/${route.bestActivityId}`}
                  className="mt-0.5 block text-caption text-accent-text"
                >
                  {t.records.recurring.best} {formatPace(route.bestPaceSecPerKm)} ·{' '}
                  {formatCompactDate(route.bestDate)}
                </Link>
              </div>

              <PaceTrail route={route} />
            </GlassSurface>
          </li>
        ))}
      </ul>
    </section>
  )
}
