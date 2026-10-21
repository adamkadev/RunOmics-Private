'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { t } from '@/i18n'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'

const CREDIT_LINKS: Record<string, string> = {
  MapTiler: 'https://www.maptiler.com/copyright/',
  OpenStreetMap: 'https://www.openstreetmap.org/copyright',
}

/** Each credit, linked to its licence page where it names one. */
function Credit({ text }: { text: string }) {
  const name = Object.keys(CREDIT_LINKS).find((n) => text.includes(n))
  if (!name) return <span className="whitespace-nowrap">{text}</span>
  return (
    <a href={CREDIT_LINKS[name]} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap underline-offset-2 hover:underline">
      {text}
    </a>
  )
}

/**
 * Every map's credits (3.0 handoff): an ⓘ in the bottom-right corner that
 * opens the MapTiler and OpenStreetMap lines above it - a 28 pt clear-glass
 * circle (Liquid Glass v3, README §6.12.5), 12 pt from the corner, which the
 * parent places; on the hero it sits above the fade. The full line used to run across the bottom of the map. The
 * parent places it; it only needs a positioned ancestor.
 */
export function MapAttribution({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('pointer-events-auto relative', className)} data-testid="map-attribution">
      {open && (
        <p
          role="note"
          className="absolute bottom-full right-0 mb-1.5 rounded-[12px] bg-[var(--raised)] px-2.5 py-1.5 text-right text-caption leading-snug text-muted-foreground shadow-[var(--shadow-raised)]"
        >
          {t.pages.map.attribution.split(' · ').map((credit, i) => (
            <Fragment key={credit}>
              {i > 0 && ' · '}
              <Credit text={credit} />
            </Fragment>
          ))}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.pages.map.credits}
        className={glassClass('clear', 'hit-44 flex size-7 items-center justify-center text-foreground')}
      >
        <GlassLayers />
        <Info size={15} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
