import Link from 'next/link'
import { Map, ChevronRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

export function ProfileMapEntry() {
  return (
    <Link href="/map">
      <GlassSurface variant="card" className="flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-accent/25 bg-accent/[0.10]">
          <Map size={18} className="text-accent-text" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">{t.profile.mapEntry.title}</span>
          <span className="block text-caption text-muted-foreground">{t.profile.mapEntry.subtitle}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-foreground/30" />
      </GlassSurface>
    </Link>
  )
}
