import type { Activity, HrDistrust } from './types'

export type { HrDistrust }

export interface HrTrust {
  /** YYYY-MM-DD, athlete.json `hrReliableFrom`: the first day a reliable sensor was worn. */
  reliableFrom?: string
  /** Runs the owner marked "HR unreliable" in their note. */
  unreliableIds: ReadonlySet<string>
}

/** As the sync's TypeContext.hr_trusted: once a reliable sensor is in use, a run on the wrist sensor alone is not trusted. */
export function hrDistrust(activity: Pick<Activity, 'id' | 'date' | 'hrSource'>, trust: HrTrust): HrDistrust | null {
  if (trust.unreliableIds.has(activity.id)) return 'marked'
  if (!trust.reliableFrom) return null
  if (activity.date.slice(0, 10) < trust.reliableFrom) return 'beforeReliable'
  return activity.hrSource === 'wrist' ? 'wrist' : null
}

function withoutHr(activity: Activity, reason: HrDistrust): Activity {
  return {
    ...activity,
    avgHeartRate: null,
    hrZones: [],
    hrSamples: null,
    splits: activity.splits?.map((split) => ({
      ...split,
      avgHr: null,
      laps: split.laps.map((lap) => ({ ...lap, avgHr: null })),
    })) ?? null,
    hrUntrusted: reason,
  }
}

/** Every heart-rate reading of an untrusted run goes, so no load, zone, efficiency or drift figure can read it. */
export function withHrTrust(activities: Activity[], trust: HrTrust): Activity[] {
  if (!trust.reliableFrom && trust.unreliableIds.size === 0) return activities
  return activities.map((activity) => {
    const reason = hrDistrust(activity, trust)
    return reason ? withoutHr(activity, reason) : activity
  })
}
