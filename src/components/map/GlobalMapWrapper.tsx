'use client'

import dynamic from 'next/dynamic'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'

const GlobalMapClient = dynamic(
  () => import('./GlobalMapClient').then((m) => m.GlobalMapClient),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
)

export function GlobalMapWrapper({ data }: { data: MapShellData }) {
  return <GlobalMapClient data={data} />
}
