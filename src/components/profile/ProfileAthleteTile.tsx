import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { t } from '@/i18n'

export function ProfileAthleteTile({ athlete }: { athlete: AthleteProfile }) {
  const a = t.profile.athlete

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-bold text-foreground">{a.title}</h2>

      <div>
        <div className="text-lg font-extrabold tracking-tight text-foreground">
          {athlete.lthrBpm ? `${athlete.lthrBpm} ${t.units.bpm}` : a.notSet}
        </div>
        <div className="mt-0.5 text-micro text-muted-foreground">{a.lthr}</div>
      </div>

      <Link
        href="/athlete"
        className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {a.viewAthlete} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
