import type { Activity, HrDistrust } from './types'

export type { HrDistrust }

export interface HrTrust {
  /** Runs the owner marked "HR unreliable" in their note. */
  unreliableIds: ReadonlySet<string>
}

/** As the sync's TypeContext.hr_trusted: the owner's mark alone distrusts a run, whatever sensor recorded it. */
export function hrDistrust(activity: Pick<Activity, 'id'>, trust: HrTrust): HrDistrust | null {
  return trust.unreliableIds.has(activity.id) ? 'marked' : null
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
  if (trust.unreliableIds.size === 0) return activities
  return activities.map((activity) => {
    const reason = hrDistrust(activity, trust)
    return reason ? withoutHr(activity, reason) : activity
  })
}
