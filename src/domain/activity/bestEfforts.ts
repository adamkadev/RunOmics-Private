/** The sync measured efforts on the wall clock, pauses included, so one longer than the moving time is dropped. */
export function plausibleBestEfforts<E extends Record<string, number> | null | undefined>(
  efforts: E,
  movingSeconds: number | undefined,
): E | null {
  if (!efforts || !movingSeconds || movingSeconds <= 0) return efforts
  const kept = Object.fromEntries(Object.entries(efforts).filter(([, seconds]) => seconds <= movingSeconds + 1))
  return Object.keys(kept).length === Object.keys(efforts).length ? efforts : Object.keys(kept).length ? (kept as E) : null
}
