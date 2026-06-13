'use client'

import dynamic from 'next/dynamic'
import type { AllRoutesData } from '@/application/usecases/GetAllRoutes'

const GlobalMapClient = dynamic(
  () => import('./GlobalMapClient').then((m) => m.GlobalMapClient),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted" /> }
)

export function GlobalMapWrapper({ data }: { data: AllRoutesData }) {
  return <GlobalMapClient data={data} />
}
