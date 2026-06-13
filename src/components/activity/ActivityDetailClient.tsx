'use client'

import { useState, type ReactNode } from 'react'
import type { Activity } from '@/domain/activity/types'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { HrChart } from './HrChart'
import { ElevationChart } from './ElevationChart'

interface Props {
  activity: Activity
  sidePanel: ReactNode
}

export function ActivityDetailClient({ activity, sidePanel }: Props) {
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {activity.route ? (
            <ActivityMapClient
              route={activity.route}
              hoverFraction={hoverFraction}
              className="h-full min-h-[300px]"
            />
          ) : (
            <NoRouteMap className="h-full min-h-[300px]" />
          )}
        </div>
        <div className="space-y-4 lg:col-span-2">{sidePanel}</div>
      </div>

      {(activity.hrSamples || activity.elevationProfile) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activity.hrSamples && (
            <HrChart
              samples={activity.hrSamples}
              avgHr={activity.avgHeartRate}
              durationSeconds={activity.durationSeconds}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
          {activity.elevationProfile && (
            <ElevationChart
              samples={activity.elevationProfile}
              durationSeconds={activity.durationSeconds}
              elevationGain={activity.elevationGain}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
        </div>
      )}
    </>
  )
}
