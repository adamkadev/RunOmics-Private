/** One night: Garmin's overnight HRV average (ms) and the day's resting HR (bpm). */
export interface RecoveryNight {
  date: string
  hrv: number | null
  restingHr: number | null
}
