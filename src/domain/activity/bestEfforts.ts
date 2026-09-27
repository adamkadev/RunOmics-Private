/**
 * A best effort can't take longer than the run's moving time (v5.5 #5). The
 * sync measured efforts on the wall clock, pauses included, so a stop could
 * make a 10K "1:02:18" on a run that took 56:27. Such an effort is dropped
 * until the FIT file is reprocessed on the moving clock.
 */
export function plausibleBestEfforts<E extends Record<string, number> | null | undefined>(
  efforts: E,
  movingSeconds: number | undefined,
): E | null {
  if (!efforts || !movingSeconds || movingSeconds <= 0) return efforts
  const kept = Object.fromEntries(Object.entries(efforts).filter(([, seconds]) => seconds <= movingSeconds + 1))
  return Object.keys(kept).length === Object.keys(efforts).length ? efforts : Object.keys(kept).length ? (kept as E) : null
}
