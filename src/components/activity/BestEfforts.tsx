import { Zap } from 'lucide-react'
import { formatDuration, formatPace } from '@/lib/formatters'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const EFFORTS = [
  { key: '1k',       label: '1K',       km: 1        },
  { key: '5k',       label: '5K',       km: 5        },
  { key: '10k',      label: '10K',      km: 10       },
  { key: 'half',     label: 'Half',     km: 21.0975  },
  { key: 'marathon', label: 'Marathon', km: 42.195   },
]

interface Props {
  bestEfforts: Record<string, number>
}

export function BestEfforts({ bestEfforts }: Props) {
  const entries = EFFORTS.filter((e) => bestEfforts[e.key] != null)
  if (!entries.length) return null

  return (
    <Card padding="lg">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={14} className="text-amber-500 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.bestEfforts.title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {entries.map(({ key, label, km }) => {
          const seconds = Math.round(bestEfforts[key])
          return (
            <div key={key} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-xs font-semibold text-subtle">{label}</p>
              <p className="mt-0.5 text-base font-bold tracking-tight text-foreground">{formatDuration(seconds)}</p>
              <p className="text-xs text-subtle">{formatPace(Math.round(seconds / km))}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
