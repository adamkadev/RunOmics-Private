/** Local-time `YYYY-MM-DD`, matching the `date` field stored on activities. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(d.getDate() + n)
  return copy
}

/** Monday-based start of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const mondayOffset = (d.getDay() || 7) - 1
  return addDays(d, -mondayOffset)
}
