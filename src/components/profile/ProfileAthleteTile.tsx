import Link from 'next/link'
import { User, ArrowRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { AthleteProfile } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { t } from '@/i18n'

export function ProfileAthleteTile({ athlete }: { athlete: AthleteProfile }) {
  const a = t.profile.athlete

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{a.title}</h2>
        <User size={16} className="text-muted-foreground" aria-hidden="true" />
      </div>

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
