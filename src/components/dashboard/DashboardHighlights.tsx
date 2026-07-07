'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/utils'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

interface Highlight {
  key: string
  href: string
  dotColor: string
  tint: string
  label: string
}

const TINT = {
  wear: { pill: 'border-red-500/35 bg-red-500/[0.14] text-red-500', dot: '#ef4444' },
}

// Race countdown intentionally absent: it already lives in TodayHero (D-x) and RaceCockpit.
export function DashboardHighlights({ shoes }: { shoes: ShoeStats[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const highlights: Highlight[] = shoes
    .filter((s) => s.nearingLimit)
    .map((shoe) => ({
      key: `shoe-${shoe.gearId}`,
      href: `/shoes/${shoe.gearId}`,
      dotColor: TINT.wear.dot,
      tint: TINT.wear.pill,
      label: shoe.name,
    }))

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const update = () => setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 1)
    update()

    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [highlights.length])

  if (highlights.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className={cn(
        '-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        canScrollRight && '[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]'
      )}
    >
      {highlights.map(({ key, href, dotColor, tint, label }) => (
        <Link key={key} href={href} className="shrink-0">
          <Pill variant="highlight" className={tint} dotColor={dotColor}>
            {label}
          </Pill>
        </Link>
      ))}
    </div>
  )
}
