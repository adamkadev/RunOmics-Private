import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { DigestFact, WeeklyDigest as WeeklyDigestData } from '@/application/usecases/GetWeeklyDigest'
import { GlassSurface } from '@/components/ui/GlassSurface'

function FactRow({ fact }: { fact: DigestFact }) {
  const Icon = fact.severity === 'watch' ? AlertTriangle : CheckCircle2
  const iconClass = fact.severity === 'watch' ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
  return (
    <li className="flex items-start gap-2 text-sm text-foreground">
      <Icon size={15} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <span>{fact.text}</span>
    </li>
  )
}

export function WeeklyDigest({ data }: { data: WeeklyDigestData }) {

  return (
    <GlassSurface variant="card" className="p-5">
      <ul className="space-y-2">
        {data.review.map((fact) => (
          <FactRow key={fact.key} fact={fact} />
        ))}
      </ul>
    </GlassSurface>
  )
}
