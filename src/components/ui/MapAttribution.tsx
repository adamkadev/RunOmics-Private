'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { t } from '@/i18n'
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
 * Every map's credits (3.0 handoff): a 22 px ⓘ in the bottom-right corner,
 * on the card at 80 %, that opens the MapTiler and OpenStreetMap lines
 * above it. The full line used to run across the bottom of the map. The
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
          className="absolute bottom-full right-0 mb-1.5 rounded-[10px] border border-[var(--line-2)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-2.5 py-1.5 text-right text-caption leading-snug text-muted-foreground"
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
        className="hit-44 flex size-[22px] items-center justify-center rounded-full border border-[var(--line-2)] bg-[color-mix(in_srgb,var(--card)_80%,transparent)] text-muted-foreground"
      >
        <Info size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
