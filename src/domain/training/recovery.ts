/** One night: Garmin's overnight HRV average (ms) and the day's resting HR (bpm). */
export interface RecoveryNight {
  date: string
  hrv: number | null
  restingHr: number | null
}

/**
 * The nights whose resting HR is a resting one (round 2, the owner's watch,
 * worn only to run, a Fitbit at night): Garmin's daily resting HR is the
 * lowest 30 minutes of the hours the watch was worn, so on a day it is worn
 * only to run it is a warm-up's - 50 to 60 against a true 45, 142 on a day
 * with one hard session. A night with an HRV reading is one the watch was
 * worn through, and only such a night's resting HR is kept. A history with no
 * HRV at all is a watch never worn to sleep: none of its days is a resting
 * HR, and the athlete's own (Garmin's settings) stands alone.
 */
export function restingNights(nights: readonly RecoveryNight[]): RecoveryNight[] {
  return nights
    .map((n) => (n.hrv === null && n.restingHr !== null ? { ...n, restingHr: null } : n))
    .filter((n) => n.hrv !== null || n.restingHr !== null)
}
