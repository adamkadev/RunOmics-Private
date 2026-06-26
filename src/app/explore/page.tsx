import Link from 'next/link'
import { BarChart2, Target, Trophy, Footprints, Map, Settings } from 'lucide-react'

const SECTIONS = [
  { href: '/analytics', label: 'Analytics',  icon: BarChart2,  color: '#3b82f6' },
  { href: '/goals',     label: 'Goals',       icon: Target,     color: '#0e9f6e' },
  { href: '/records',   label: 'Records',     icon: Trophy,     color: '#8b5cf6' },
  { href: '/shoes',     label: 'Shoes',       icon: Footprints, color: '#f97316' },
  { href: '/map',       label: 'Heatmap',     icon: Map,        color: '#06b6d4' },
  { href: '/settings',  label: 'Settings',    icon: Settings,   color: '#94a3b8' },
]

export default function ExplorePage() {
  return (
    <div className="px-4 pb-[max(env(safe-area-inset-bottom),80px)] pt-4">
      <h1 className="text-title1 font-extrabold mb-6 text-foreground">Explore</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, label, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="glass-card flex flex-col items-center gap-3 p-6 rounded-card text-center
                       transition-transform active:scale-[0.97]"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: `${color}1a`, border: `1px solid ${color}33` }}
            >
              <Icon size={22} style={{ color }} strokeWidth={2} />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
